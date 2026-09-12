import { mkdtemp, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { postgresAdapter } from "@payloadcms/db-postgres";
import {
  buildConfig,
  getPayload,
  handleEndpoints,
  type Payload,
} from "payload";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Media } from "./Media";
import { Posts } from "./Posts";
import { SeoRuns } from "./SeoRuns";
import { SeoTopics } from "./SeoTopics";
import { Services } from "./Services";
import { Users } from "./Users";

const initialBody = "Syntetisk opprinnelig offentlig artikkel.";
const editedBody = "Syntetisk redigert, men ukontrollert utkast.";
const cacheKey = "phase2d-native-restore-endpoint";

type StoredVersion = {
  id: string;
  version: { _status?: "draft" | "published"; contentNo?: string };
};

describe("Posts native version restore endpoint (isolated PostgreSQL)", () => {
  let payload: Payload;
  let tempRoot: string;
  let adminToken: string;
  let workerToken: string;
  let fixturePrefix: string;
  let postSequence = 0;
  let postID: string | number;

  beforeAll(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), "payload-post-restore-endpoint-"));
    if (!Media.upload || typeof Media.upload !== "object") {
      throw new TypeError("The real Media collection must expose upload config");
    }
    const config = await buildConfig({
      secret: "phase2d-native-restore-only-not-a-production-secret",
      serverURL: "https://example.invalid",
      telemetry: false,
      admin: { user: Users.slug },
      collections: [
        Users,
        {
          ...Media,
          upload: { ...Media.upload, staticDir: path.join(tempRoot, "media") },
        },
        Services,
        SeoTopics,
        SeoRuns,
        Posts,
      ],
      db: postgresAdapter({
        pool: {
          connectionString:
            "postgresql://phase2b_qa@127.0.0.1:55432/phase2d_native_restore_endpoint",
          max: 10,
        },
        transactionOptions: false,
        push: true,
      }),
    });
    payload = await getPayload({ config, key: cacheKey });
    fixturePrefix = randomUUID();

    await payload.create({
      collection: "users",
      overrideAccess: true,
      data: {
        email: `restore-admin-${fixturePrefix}@example.invalid`,
        password: "Synthetic-local-only-password-123",
        displayName: "Synthetic Restore Admin",
        active: true,
        interfaceLanguage: "nb",
        role: "admin",
      },
    });
    await payload.create({
      collection: "users",
      overrideAccess: true,
      data: {
        email: `restore-worker-${fixturePrefix}@example.invalid`,
        password: "Synthetic-local-only-password-456",
        displayName: "Synthetic Restore Worker",
        active: true,
        interfaceLanguage: "nb",
        role: "worker",
      },
    });

    adminToken = (
      await payload.login({
        collection: "users",
        data: {
          email: `restore-admin-${fixturePrefix}@example.invalid`,
          password: "Synthetic-local-only-password-123",
        },
      })
    ).token!;
    workerToken = (
      await payload.login({
        collection: "users",
        data: {
          email: `restore-worker-${fixturePrefix}@example.invalid`,
          password: "Synthetic-local-only-password-456",
        },
      })
    ).token!;
  });

  afterAll(async () => {
    await payload?.destroy();
    const resolvedTempRoot = path.resolve(tempRoot);
    const resolvedTmpDirectory = path.resolve(tmpdir());
    if (
      !tempRoot ||
      resolvedTempRoot === path.parse(resolvedTempRoot).root ||
      path.dirname(resolvedTempRoot) !== resolvedTmpDirectory ||
      !path.basename(resolvedTempRoot).startsWith("payload-post-restore-endpoint-")
    ) {
      throw new TypeError("Refusing to remove an unexpected native-restore test path");
    }
    await rm(tempRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  });

  async function createApprovedPublishedPost(body = initialBody) {
    postSequence += 1;
    const draft = await payload.create({
      collection: "posts",
      overrideAccess: true,
      draft: true,
      data: {
        slug: `native-restore-endpoint-${fixturePrefix}-${postSequence}`,
        titleNo: "Syntetisk gjenopprettingstest",
        contentNo: body,
        authorName: "Synthetic Author",
        editorialStatus: "human_review",
        aiAssisted: true,
        _status: "draft",
      },
    });
    await payload.update({
      collection: "posts",
      id: draft.id,
      overrideAccess: true,
      draft: true,
      context: { trustedBlogQualityRevalidation: true },
      data: {
        contentNo: body,
        editorialStatus: "human_review",
        qualityScore: 92,
        qualityChecks: { passed: true },
        sources: [{ label: "Synthetic source", url: "https://example.invalid/source" }],
      },
    });
    await payload.update({
      collection: "posts",
      id: draft.id,
      overrideAccess: true,
      draft: true,
      data: {
        editorialStatus: "approved",
        reviewerName: "Synthetic Reviewer",
        reviewedAt: "2026-09-12T10:00:00.000Z",
      },
    });
    await payload.update({
      collection: "posts",
      id: draft.id,
      overrideAccess: true,
      draft: false,
      data: {
        _status: "published",
        editorialStatus: "approved",
        authorName: "Synthetic Author",
      },
    });
    return draft.id;
  }

  async function publishReviewedBody(id: string | number, body: string) {
    await payload.update({
      collection: "posts",
      id,
      overrideAccess: true,
      draft: true,
      context: { trustedBlogQualityRevalidation: true },
      data: {
        contentNo: body,
        editorialStatus: "human_review",
        qualityScore: 93,
        qualityChecks: { passed: true },
      },
    });
    await payload.update({
      collection: "posts",
      id,
      overrideAccess: true,
      draft: true,
      data: {
        editorialStatus: "approved",
        reviewerName: "Synthetic Reviewer",
        reviewedAt: "2026-09-12T10:10:00.000Z",
      },
    });
    await payload.update({
      collection: "posts",
      id,
      overrideAccess: true,
      draft: false,
      data: { _status: "published", editorialStatus: "approved" },
    });
  }

  async function versionsFor(id: string | number) {
    return (await payload.findVersions({
      collection: "posts",
      overrideAccess: true,
      where: { parent: { equals: id } },
      limit: 50,
    })).docs as StoredVersion[];
  }

  async function restoreThroughNativeEndpoint(versionID: string, token?: string) {
    return handleEndpoints({
      config: payload.config,
      payloadInstanceCacheKey: cacheKey,
      request: new Request(
        `https://example.invalid/api/posts/versions/${encodeURIComponent(versionID)}?draft=false`,
        {
          method: "POST",
          // This is the installed Payload Admin's normal restore request. The
          // collection endpoint must ignore its unsafe flag and force draft.
          headers: token ? { Authorization: `JWT ${token}` } : undefined,
        },
      ),
    });
  }

  async function publicPost(id: string | number) {
    const result = await payload.find({
      collection: "posts",
      overrideAccess: false,
      where: { id: { equals: id } },
    });
    expect(result.docs).toHaveLength(1);
    return result.docs[0];
  }

  beforeEach(async () => {
    postID = await createApprovedPublishedPost();
  });

  it("restores a selected draft version through the native endpoint as review-required draft", async () => {
    await payload.update({
      collection: "posts",
      id: postID,
      overrideAccess: true,
      draft: true,
      data: { contentNo: editedBody },
    });
    const selected = (await versionsFor(postID)).find(
      (version) => version.version._status === "draft" && version.version.contentNo === editedBody,
    );
    expect(selected).toBeDefined();

    const response = await restoreThroughNativeEndpoint(selected!.id, adminToken);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      _status: "draft",
      editorialStatus: "human_review",
      contentNo: editedBody,
    });

    await expect(publicPost(postID)).resolves.toMatchObject({
      _status: "published",
      editorialStatus: "published",
      contentNo: initialBody,
    });
  });

  it("restores a selected older published version as a draft without replacing newer public content", async () => {
    const newerBody = "Syntetisk nyere kontrollert offentlig artikkel.";
    await publishReviewedBody(postID, newerBody);
    const selected = (await versionsFor(postID)).find(
      (version) => version.version._status === "published" && version.version.contentNo === initialBody,
    );
    expect(selected).toBeDefined();

    const response = await restoreThroughNativeEndpoint(selected!.id, adminToken);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      _status: "draft",
      editorialStatus: "human_review",
      contentNo: initialBody,
      reviewerName: null,
      reviewedAt: null,
      qualityScore: null,
    });

    await expect(publicPost(postID)).resolves.toMatchObject({
      _status: "published",
      editorialStatus: "published",
      contentNo: newerBody,
    });
  });

  it("rejects anonymous and non-admin attempts to restore a version owned by a post", async () => {
    const selected = (await versionsFor(postID)).find(
      (version) => version.version._status === "published",
    );
    expect(selected).toBeDefined();

    expect((await restoreThroughNativeEndpoint(selected!.id)).status).toBe(401);
    expect((await restoreThroughNativeEndpoint(selected!.id, workerToken)).status).toBe(403);
    await expect(publicPost(postID)).resolves.toMatchObject({
      _status: "published",
      editorialStatus: "published",
      contentNo: initialBody,
    });
  });
});
