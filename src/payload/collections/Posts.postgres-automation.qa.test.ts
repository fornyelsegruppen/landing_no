import { mkdtemp, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { postgresAdapter, sql } from "@payloadcms/db-postgres";
import {
  buildConfig,
  getPayload,
  handleEndpoints,
  type Payload,
} from "payload";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { Media } from "./Media";
import { Posts } from "./Posts";
import { SeoRuns } from "./SeoRuns";
import { SeoTopics } from "./SeoTopics";
import { Services } from "./Services";
import { Users } from "./Users";
import { withSeoTransaction } from "../../lib/blog/post-write-transaction";
import { publishDueBlogPosts } from "../../lib/blog/scheduled-publisher";
import { claimSeoRun } from "../../lib/blog/seo-run-state";
import {
  regeneratePayloadBlogPost,
  generateNextPayloadBlogDraft,
} from "../../lib/blog/payload-blog-engine";
import { validGeneratedArticle } from "../../lib/blog/test-fixtures";
import { restorePostVersionAsDraft } from "../../lib/blog/restore-post-version";
const invalidate = vi.hoisted(() => vi.fn());
vi.mock("../../lib/blog/invalidate-public-blog", () => ({
  invalidatePublicBlog: invalidate,
}));

vi.mock("@/lib/ai/payload-usage-limit", () => ({
  assertPayloadAiUsageAvailable: async () => undefined,
}));
vi.mock("../../lib/blog/draft-engine", async (original) => ({
  ...(await original<typeof import("../../lib/blog/draft-engine")>()),
  generateBlogDraft: async ({
    provider,
  }: {
    provider: { generate(input: object): Promise<{ data: unknown }> };
  }) => (await provider.generate({})).data,
}));

const initialBody = "Syntetisk opprinnelig offentlig artikkel.";
const editedBody = "Syntetisk redigert, men ukontrollert utkast.";
const cacheKey = "seo-automation-core";

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
  let injectSqlFailureId: string | number | null = null;

  beforeAll(async () => {
    tempRoot = await mkdtemp(
      path.join(tmpdir(), "payload-post-restore-endpoint-"),
    );
    if (!Media.upload || typeof Media.upload !== "object") {
      throw new TypeError(
        "The real Media collection must expose upload config",
      );
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
        {
          ...Posts,
          hooks: {
            ...Posts.hooks,
            afterChange: [
              async ({ doc, req }) => {
                if (doc.id === injectSqlFailureId) {
                  injectSqlFailureId = null;
                  const db = req.payload.db as unknown as {
                    sessions: Record<
                      string,
                      {
                        db: {
                          execute(q: ReturnType<typeof sql>): Promise<unknown>;
                        };
                      }
                    >;
                  };
                  await db.sessions[String(await req.transactionID)].db.execute(
                    sql`select 1 / 0`,
                  );
                }
                return doc;
              },
            ],
          },
        },
      ],
      db: postgresAdapter({
        pool: {
          connectionString:
            "postgresql://phase2b_qa@127.0.0.1:55432/seo_automation_core_20260912",
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
      !path
        .basename(resolvedTempRoot)
        .startsWith("payload-post-restore-endpoint-")
    ) {
      throw new TypeError(
        "Refusing to remove an unexpected native-restore test path",
      );
    }
    await rm(tempRoot, {
      recursive: true,
      force: true,
      maxRetries: 20,
      retryDelay: 250,
    });
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
        qualityChecks: {
          policyVersion: "2026-09-12-repetition-v1",
          passed: true,
        },
        sources: [
          { label: "Synthetic source", url: "https://example.invalid/source" },
        ],
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
        qualityChecks: {
          policyVersion: "2026-09-12-repetition-v1",
          passed: true,
        },
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
    return (
      await payload.findVersions({
        collection: "posts",
        overrideAccess: true,
        where: { parent: { equals: id } },
        limit: 50,
      })
    ).docs as StoredVersion[];
  }

  async function restoreThroughNativeEndpoint(
    versionID: string,
    token?: string,
  ) {
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
    invalidate.mockClear();
  });

  it("invalidates public caches once after the outer real commit and never after rollback", async () => {
    await withSeoTransaction(payload, async (req) => {
      await payload.update({
        collection: "posts",
        id: postID,
        req,
        draft: true,
        overrideAccess: true,
        data: { contentNo: editedBody },
      });
      expect(invalidate).not.toHaveBeenCalled();
      await payload.update({
        collection: "posts",
        id: postID,
        req,
        draft: true,
        overrideAccess: true,
        data: { contentNo: `${editedBody} Again.` },
      });
      expect(invalidate).not.toHaveBeenCalled();
    });
    expect(invalidate).toHaveBeenCalledTimes(1);
    invalidate.mockClear();
    await expect(
      withSeoTransaction(payload, async (req) => {
        await payload.update({
          collection: "posts",
          id: postID,
          req,
          draft: false,
          overrideAccess: true,
          data: { _status: "draft" },
        });
        throw new Error("cache rollback fixture");
      }),
    ).rejects.toThrow("cache rollback fixture");
    expect(invalidate).not.toHaveBeenCalled();
    await expect(publicPost(postID)).resolves.toMatchObject({
      _status: "published",
    });
  });

  it("guarded unpublish rejects a same-timestamp revision change without removing public content", async () => {
    const post = await payload.findByID({
      collection: "posts",
      id: postID,
      draft: true,
    });
    const { postRevision } = await import("../../lib/blog/post-revision");
    await expect(
      payload.update({
        collection: "posts",
        id: postID,
        draft: false,
        overrideAccess: true,
        context: {
          expectedBlogUpdatedAt: post.updatedAt,
          expectedBlogRevision: postRevision({
            ...post,
            contentNo: "Stale revision",
          }),
        },
        data: {
          _status: "draft",
          editorialStatus: "human_review",
          scheduledAt: null,
          reviewerName: null,
          reviewedAt: null,
          qualityChecks: null,
          qualityScore: null,
        },
      }),
    ).rejects.toThrow(/changed/);
    expect(invalidate).not.toHaveBeenCalled();
    await expect(publicPost(postID)).resolves.toMatchObject({
      _status: "published",
    });
  });

  it("guarded base unpublish accepts the latest private draft revision and preserves its content", async () => {
    await payload.update({
      collection: "posts",
      id: postID,
      draft: true,
      overrideAccess: true,
      data: { contentNo: editedBody },
    });
    const post = await payload.findByID({
      collection: "posts",
      id: postID,
      draft: true,
      overrideAccess: true,
    });
    const { postRevision } = await import("../../lib/blog/post-revision");
    const result = await payload.update({
      collection: "posts",
      id: postID,
      draft: false,
      overrideAccess: true,
      context: {
        expectedBlogUpdatedAt: post.updatedAt,
        expectedBlogRevision: postRevision(post),
      },
      data: {
        _status: "draft",
        editorialStatus: "human_review",
        scheduledAt: null,
        reviewerName: null,
        reviewedAt: null,
        qualityChecks: null,
        qualityScore: null,
      },
    });
    expect(result).toMatchObject({ _status: "draft", contentNo: editedBody });
    expect(
      (
        await payload.find({
          collection: "posts",
          draft: false,
          overrideAccess: false,
          where: { id: { equals: postID } },
        })
      ).docs,
    ).toHaveLength(0);
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
      (version) =>
        version.version._status === "draft" &&
        version.version.contentNo === editedBody,
    );
    expect(selected).toBeDefined();

    const response = await restoreThroughNativeEndpoint(
      selected!.id,
      adminToken,
    );
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
      (version) =>
        version.version._status === "published" &&
        version.version.contentNo === initialBody,
    );
    expect(selected).toBeDefined();

    const response = await restoreThroughNativeEndpoint(
      selected!.id,
      adminToken,
    );
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

  it("native unpublish removes the public document, preserves versions, and restore does not republish", async () => {
    const selected = (await versionsFor(postID)).find(
      (version) => version.version._status === "published",
    );
    expect(selected).toBeDefined();
    await payload.update({
      collection: "posts",
      id: postID,
      draft: true,
      overrideAccess: true,
      data: {
        _status: "draft",
        editorialStatus: "rejected",
        scheduledAt: null,
      },
    });
    // Reject applies to the working draft, not the existing public revision.
    await expect(publicPost(postID)).resolves.toMatchObject({
      _status: "published",
    });
    const response = await handleEndpoints({
      config: payload.config,
      payloadInstanceCacheKey: cacheKey,
      request: new Request(
        `https://example.invalid/api/posts/${postID}?draft=false`,
        {
          method: "PATCH",
          headers: {
            Authorization: `JWT ${adminToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ _status: "draft" }),
        },
      ),
    });
    expect(response.status).toBe(200);
    const visible = () =>
      payload.find({
        collection: "posts",
        draft: false,
        overrideAccess: false,
        where: { id: { equals: postID } },
      });
    expect((await visible()).docs).toHaveLength(0);
    expect(
      (await versionsFor(postID)).some(
        (version) => version.id === selected!.id,
      ),
    ).toBe(true);
    const restored = await restoreThroughNativeEndpoint(
      selected!.id,
      adminToken,
    );
    expect(restored.status).toBe(200);
    await expect(restored.json()).resolves.toMatchObject({
      _status: "draft",
      editorialStatus: "human_review",
      reviewerName: null,
      reviewedAt: null,
      qualityScore: null,
      qualityChecks: null,
      scheduledAt: null,
    });
    expect((await visible()).docs).toHaveLength(0);
  });

  it("native unpublish is authenticated and cancels a retained approved schedule", async () => {
    const unpublish = (token?: string) =>
      handleEndpoints({
        config: payload.config,
        payloadInstanceCacheKey: cacheKey,
        request: new Request(`https://example.invalid/api/posts/${postID}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `JWT ${token}` } : {}),
          },
          body: JSON.stringify({ _status: "draft" }),
        }),
      });
    expect((await unpublish()).status).toBeGreaterThanOrEqual(400);
    expect((await unpublish(workerToken)).status).toBe(403);
    await expect(publicPost(postID)).resolves.toMatchObject({
      _status: "published",
    });
    await payload.update({
      collection: "posts",
      id: postID,
      draft: true,
      overrideAccess: true,
      data: {
        editorialStatus: "scheduled",
        scheduledAt: "2026-01-01T09:00:00.000Z",
      },
    });
    expect((await unpublish(adminToken)).status).toBe(200);
    const latest = await payload.findByID({
      collection: "posts",
      id: postID,
      draft: true,
      overrideAccess: true,
    });
    expect(latest).toMatchObject({
      _status: "draft",
      editorialStatus: "human_review",
      scheduledAt: null,
      reviewerName: null,
      reviewedAt: null,
      qualityScore: null,
      qualityChecks: null,
    });
    const { localizedBlogPostEntries } = await import("../../lib/blog/sitemap");
    expect(
      localizedBlogPostEntries(latest, new Date(), "https://example.invalid"),
    ).toEqual([]);
  });

  it("rejects anonymous and non-admin attempts to restore a version owned by a post", async () => {
    const selected = (await versionsFor(postID)).find(
      (version) => version.version._status === "published",
    );
    expect(selected).toBeDefined();

    expect((await restoreThroughNativeEndpoint(selected!.id)).status).toBe(401);
    expect(
      (await restoreThroughNativeEndpoint(selected!.id, workerToken)).status,
    ).toBe(403);
    await expect(publicPost(postID)).resolves.toMatchObject({
      _status: "published",
      editorialStatus: "published",
      contentNo: initialBody,
    });
  });

  async function scheduledPost() {
    await payload.update({
      collection: "posts",
      id: postID,
      overrideAccess: true,
      draft: true,
      data: {
        _status: "draft",
        editorialStatus: "scheduled",
        scheduledAt: "2026-09-12T00:00:00.000Z",
      },
    });
  }

  async function waitForContender() {
    const pool = (
      payload.db as unknown as {
        pool: { query(q: string): Promise<{ rows: { count: string }[] }> };
      }
    ).pool;
    for (let n = 0; n < 100; n++) {
      const found = await pool.query(
        "select count(*) from pg_locks where locktype = 'advisory' and classid = 731246 and objid = 1 and not granted",
      );
      if (Number(found.rows[0].count) > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("No independently blocked PostgreSQL writer observed");
  }

  it("legacy QA100 blocks native approval and publication and sends scheduler to review without unpublishing", async () => {
    await scheduledPost();
    // Simulate an already stored result from a prior release, only in this
    // isolated test document. No policy version is fabricated onto old evidence.
    const isolatedDb = payload.db as unknown as {
      drizzle: { execute(q: ReturnType<typeof sql>): Promise<unknown> };
    };
    await isolatedDb.drizzle.execute(
      sql`update _posts_v set version_quality_checks = '{"passed":true}'::jsonb, version_quality_score = 100 where parent_id = ${postID} and latest = true`,
    );
    await expect(
      payload.update({
        collection: "posts",
        id: postID,
        draft: true,
        overrideAccess: true,
        data: { editorialStatus: "approved" },
      }),
    ).rejects.toThrow(/Current deterministic/);
    const publish = await handleEndpoints({
      config: payload.config,
      payloadInstanceCacheKey: cacheKey,
      request: new Request(`https://example.invalid/api/posts/${postID}`, {
        method: "PATCH",
        headers: {
          Authorization: `JWT ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ _status: "published" }),
      }),
    });
    expect(publish.status).toBeGreaterThanOrEqual(400);
    const result = await publishDueBlogPosts(
      payload,
      new Date("2026-09-12T10:00:00.000Z"),
    );
    expect(result.published).not.toContain(postID);
    expect(result.attention).toContain(postID);
    await expect(publicPost(postID)).resolves.toMatchObject({
      _status: "published",
      contentNo: initialBody,
    });
    const latest = await payload.findByID({
      collection: "posts",
      id: postID,
      draft: true,
      overrideAccess: true,
    });
    expect(latest).toMatchObject({
      editorialStatus: "human_review",
      reviewerName: null,
      scheduledAt: null,
    });
  });

  it("native edit waits for publish commit and preserves the committed public revision", async () => {
    await scheduledPost();
    let edit!: Promise<unknown>;
    await withSeoTransaction(payload, async (req) => {
      const original = await payload.findByID({
        collection: "posts",
        id: postID,
        overrideAccess: true,
        draft: true,
        req,
      });
      edit = payload.update({
        collection: "posts",
        id: postID,
        overrideAccess: true,
        draft: true,
        data: { contentNo: editedBody },
      });
      await waitForContender();
      await payload.update({
        collection: "posts",
        id: postID,
        req,
        overrideAccess: true,
        draft: false,
        context: { expectedBlogUpdatedAt: original.updatedAt },
        data: { _status: "published" },
      });
    });
    await edit;
    expect(await publicPost(postID)).toMatchObject({
      contentNo: initialBody,
      _status: "published",
    });
    expect(
      await payload.findByID({
        collection: "posts",
        id: postID,
        draft: true,
        overrideAccess: true,
      }),
    ).toMatchObject({
      contentNo: editedBody,
      editorialStatus: "human_review",
      reviewerName: null,
    });
  });

  it("publisher waits for native edit and refuses to publish its stale approved snapshot", async () => {
    await scheduledPost();
    let publish!: ReturnType<typeof publishDueBlogPosts>;
    await withSeoTransaction(payload, async (req) => {
      publish = publishDueBlogPosts(payload);
      await waitForContender();
      await payload.update({
        collection: "posts",
        id: postID,
        req,
        draft: true,
        overrideAccess: true,
        data: { contentNo: editedBody },
      });
    });
    const result = await publish;
    expect(result.published).not.toContain(postID);
    expect(result.skipped).toContain(postID);
    expect(await publicPost(postID)).toMatchObject({ contentNo: initialBody });
  });

  it("two publishers commit a scheduled revision at most once", async () => {
    await scheduledPost();
    const results = await Promise.all([
      publishDueBlogPosts(payload),
      publishDueBlogPosts(payload),
    ]);
    expect(
      results.flatMap((r) => r.published).filter((id) => id === postID),
    ).toHaveLength(1);
  });

  it("publisher waits for a version restore and leaves it as an unreviewed draft", async () => {
    await scheduledPost();
    const version = (await versionsFor(postID)).find(
      (v) => v.version._status === "published",
    )!;
    let publish!: ReturnType<typeof publishDueBlogPosts>;
    await withSeoTransaction(payload, async (req) => {
      const auth = await payload.auth({
        headers: new Headers({ Authorization: `JWT ${adminToken}` }),
      });
      req.user = auth.user;
      publish = publishDueBlogPosts(payload);
      await waitForContender();
      await restorePostVersionAsDraft({ payload, req, versionID: version.id });
    });
    expect((await publish).published).not.toContain(postID);
    expect(
      await payload.findByID({
        collection: "posts",
        id: postID,
        draft: true,
        overrideAccess: true,
      }),
    ).toMatchObject({ editorialStatus: "human_review", reviewerName: null });
    expect(await publicPost(postID)).toMatchObject({ contentNo: initialBody });
  });

  it("rejects stale approval and rolls back draft/version writes together on error", async () => {
    const original = await payload.findByID({
      collection: "posts",
      id: postID,
      draft: true,
      overrideAccess: true,
    });
    await payload.update({
      collection: "posts",
      id: postID,
      draft: true,
      overrideAccess: true,
      data: { contentNo: editedBody },
    });
    await expect(
      payload.update({
        collection: "posts",
        id: postID,
        draft: true,
        overrideAccess: true,
        context: { expectedBlogUpdatedAt: original.updatedAt },
        data: {
          editorialStatus: "approved",
          reviewerName: "Stale review",
          reviewedAt: new Date().toISOString(),
        },
      }),
    ).rejects.toThrow("Article changed");
    const before = await versionsFor(postID);
    await expect(
      withSeoTransaction(payload, async (req) => {
        await payload.update({
          collection: "posts",
          id: postID,
          req,
          draft: true,
          overrideAccess: true,
          data: { contentNo: "Must roll back" },
        });
        throw new Error("Synthetic rollback");
      }),
    ).rejects.toThrow("Synthetic rollback");
    expect(await versionsFor(postID)).toHaveLength(before.length);
    expect(
      await payload.findByID({
        collection: "posts",
        id: postID,
        draft: true,
        overrideAccess: true,
      }),
    ).toMatchObject({ contentNo: editedBody });
  });

  it("claims one durable run for overlapping same-key invocations", async () => {
    const key = "seo-local-" + randomUUID();
    const claims = await Promise.all([
      claimSeoRun(payload, { idempotencyKey: key, triggerSource: "cron" }),
      claimSeoRun(payload, { idempotencyKey: key, triggerSource: "cron" }),
    ]);
    expect(claims.filter((c) => c.claimed)).toHaveLength(1);
    expect(claims[0].run.id).toBe(claims[1].run.id);
  });

  it("different concurrent run keys reserve different topics before provider work", async () => {
    const keys = ["topic-a-" + randomUUID(), "topic-b-" + randomUUID()];
    // The isolated database retains prior test evidence. Give this test its own
    // topics instead of exhausting the ten intentionally single-use seed topics.
    const fixtureTopics = await Promise.all(
      keys.map((key) =>
        payload.create({
          collection: "seo-topics",
          overrideAccess: true,
          data: {
            fingerprint: key,
            topic: `Syntetisk takvask ${key}`,
            primaryKeyword: `takvask ${key}`,
            searchIntent: "informational",
            source: "manual",
            status: "candidate",
            topicScore: 100,
            overlapScore: 0,
            reasonForSelection: "Isolated concurrency fixture only",
            scoreBreakdown: {
              serviceRelevance: 1,
              demand: 1,
              commercialValue: 1,
              contentGap: 1,
              seasonalRelevance: 1,
              originalEvidence: 1,
              localRelevance: 1,
            },
          },
        }),
      ),
    );
    try {
      await Promise.allSettled(
        keys.map((idempotencyKey) =>
          generateNextPayloadBlogDraft({
            payload,
            idempotencyKey,
            triggerSource: "manual",
            correlationId: "local-only",
            provider: {
              health: () => ({ provider: "synthetic", status: "ready" }),
              generate: async () => {
                throw new Error("Synthetic provider stopped after reservation");
              },
            },
          }),
        ),
      );
      const runs = await payload.find({
        collection: "seo-runs",
        depth: 0,
        overrideAccess: true,
        where: { idempotencyKey: { in: keys } },
      });
      expect(runs.docs).toHaveLength(2);
      expect(
        runs.docs.every(
          (run) =>
            run.status === "attention" && run.selectedTopics?.length === 1,
        ),
      ).toBe(true);
      expect(runs.docs[0].selectedTopics?.[0]).not.toBe(
        runs.docs[1].selectedTopics?.[0],
      );
      expect(runs.docs.map((run) => run.selectedTopics?.[0]).sort()).toEqual(
        fixtureTopics.map((topic) => topic.id).sort(),
      );
    } finally {
      // Retain the evidence and relationships, but keep test-owned candidates
      // out of later runs' bounded selection pool. No shared/user rows touched.
      for (const topic of fixtureTopics)
        await payload.update({
          collection: "seo-topics",
          id: topic.id,
          overrideAccess: true,
          data: { status: "rejected" },
        });
    }
  });

  it("rolls back native bulk writes after a caught SQL failure instead of reporting success", async () => {
    const second = await createApprovedPublishedPost();
    injectSqlFailureId = second;
    await expect(
      payload.update({
        collection: "posts",
        draft: true,
        overrideAccess: true,
        where: { id: { in: [postID, second] } },
        data: { contentNo: "Bulk must roll back" },
      }),
    ).rejects.toThrow();
    for (const id of [postID, second]) {
      expect(
        await payload.findByID({
          collection: "posts",
          id,
          draft: true,
          overrideAccess: true,
        }),
      ).toMatchObject({ contentNo: initialBody });
    }
  });

  it("caught nested errors poison the owner and prevent subsequent autocommit writes", async () => {
    await expect(
      withSeoTransaction(payload, async (req) => {
        try {
          await payload.update({
            collection: "posts",
            id: postID,
            req,
            draft: false,
            overrideAccess: true,
            data: { reviewerName: null, _status: "published" },
          });
        } catch {
          /* Deliberately catch the inner failure to exercise ownership loss. */
        }
        await expect(
          payload.update({
            collection: "posts",
            id: postID,
            req,
            draft: true,
            overrideAccess: true,
            data: { contentNo: "Must never autocommit" },
          }),
        ).rejects.toThrow("ownership");
      }),
    ).rejects.toThrow("ownership");
    expect(await publicPost(postID)).toMatchObject({ contentNo: initialBody });
  });

  it("a caught nested failure cannot return success even when no further write is attempted", async () => {
    await expect(
      withSeoTransaction(payload, async (req) => {
        try {
          await payload.update({
            collection: "posts",
            id: postID,
            req,
            draft: false,
            overrideAccess: true,
            data: { _status: "published", reviewerName: null },
          });
        } catch {
          /* Owner must still fail after Payload removed transactionID. */
        }
        return "not a valid success";
      }),
    ).rejects.toThrow("ownership");
  });

  it("a swallowed SQL error fails the commit probe and releases its session", async () => {
    const db = payload.db as unknown as {
      sessions: Record<
        string,
        { db: { execute(q: ReturnType<typeof sql>): Promise<unknown> } }
      >;
    };
    const before = Object.keys(db.sessions).length;
    await expect(
      withSeoTransaction(payload, async (req) => {
        try {
          await db.sessions[String(await req.transactionID)].db.execute(
            sql`select 1 / 0`,
          );
        } catch {
          /* PostgreSQL is aborted, even if the caller catches this. */
        }
        return "cannot commit";
      }),
    ).rejects.toThrow();
    expect(Object.keys(db.sessions)).toHaveLength(before);
  });

  it("propagates a real deferred constraint failure at COMMIT and rolls back the post", async () => {
    const db = payload.db as unknown as {
      sessions: Record<
        string,
        { db: { execute(q: ReturnType<typeof sql>): Promise<unknown> } }
      >;
    };
    const before = Object.keys(db.sessions).length;
    let passedProbe = false;
    await expect(
      withSeoTransaction(payload, async (req) => {
        await payload.update({
          collection: "posts",
          id: postID,
          req,
          draft: true,
          overrideAccess: true,
          data: { contentNo: "Cannot survive failed commit" },
        });
        const session = db.sessions[String(await req.transactionID)].db;
        await session.execute(
          sql`create temporary table seo_commit_failure (id integer primary key, parent integer, foreign key (parent) references seo_commit_failure(id) deferrable initially deferred)`,
        );
        await session.execute(
          sql`insert into seo_commit_failure values (1, 2)`,
        );
        await session.execute(sql`select 1`);
        passedProbe = true;
      }),
    ).rejects.toThrow();
    expect(passedProbe).toBe(true);
    expect(invalidate).not.toHaveBeenCalled();
    expect(Object.keys(db.sessions)).toHaveLength(before);
    expect(
      await payload.findByID({
        collection: "posts",
        id: postID,
        draft: true,
        overrideAccess: true,
      }),
    ).toMatchObject({ contentNo: initialBody });
  });

  it.each(["request-id", "session"])(
    "explicit %s loss cannot commit and releases the immutable owned session",
    async (loss) => {
      const db = payload.db as unknown as { sessions: Record<string, unknown> };
      const before = Object.keys(db.sessions).length;
      await expect(
        withSeoTransaction(payload, async (req) => {
          await payload.update({
            collection: "posts",
            id: postID,
            req,
            draft: true,
            overrideAccess: true,
            data: { contentNo: "Lost ownership" },
          });
          if (loss === "request-id") delete req.transactionID;
          else delete db.sessions[String(await req.transactionID)];
        }),
      ).rejects.toThrow("ownership");
      expect(Object.keys(db.sessions)).toHaveLength(before);
      expect(
        await payload.findByID({
          collection: "posts",
          id: postID,
          draft: true,
          overrideAccess: true,
        }),
      ).toMatchObject({ contentNo: initialBody });
    },
  );

  it("a lock timeout fails safely and leaves no leaked adapter session", async () => {
    const db = payload.db as unknown as { sessions: Record<string, unknown> };
    const before = Object.keys(db.sessions).length;
    await withSeoTransaction(payload, async () => {
      await expect(
        payload.update({
          collection: "posts",
          id: postID,
          draft: true,
          overrideAccess: true,
          data: { contentNo: "Lock timed out" },
        }),
      ).rejects.toThrow();
    });
    expect(Object.keys(db.sessions)).toHaveLength(before);
    expect(
      await payload.findByID({
        collection: "posts",
        id: postID,
        draft: true,
        overrideAccess: true,
      }),
    ).toMatchObject({ contentNo: initialBody });
  }, 12_000);

  it("regeneration cannot overwrite a native edit made while the provider is running", async () => {
    await payload.update({
      collection: "posts",
      id: postID,
      draft: true,
      overrideAccess: true,
      data: { _status: "draft", editorialStatus: "human_review" },
    });
    let entered!: () => void, release!: () => void;
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const generation = regeneratePayloadBlogPost({
      payload,
      postId: Number(postID),
      idempotencyKey: "regen-" + randomUUID(),
      correlationId: "local-only",
      provider: {
        health: () => ({ provider: "synthetic", status: "ready" }),
        generate: async () => {
          entered();
          await gate;
          return {
            provider: "synthetic",
            model: "test",
            promptVersion: "test",
            data: {
              article: validGeneratedArticle(),
              quality: { passed: true, score: 95 },
              model: "test",
              promptVersion: "test",
              knowledgeVersion: "test",
            },
          };
        },
      },
    });
    // Attach before release so a legitimate rejection is never unhandled.
    const rejected = expect(generation).rejects.toThrow("Article changed");
    await ready;
    await payload.update({
      collection: "posts",
      id: postID,
      draft: true,
      overrideAccess: true,
      data: { contentNo: editedBody },
    });
    release();
    await rejected;
    expect(
      await payload.findByID({
        collection: "posts",
        id: postID,
        draft: true,
        overrideAccess: true,
      }),
    ).toMatchObject({ contentNo: editedBody });
    expect(await publicPost(postID)).toMatchObject({ contentNo: initialBody });
  });
});
