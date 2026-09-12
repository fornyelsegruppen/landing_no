import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixtureMetadataPatch } from "./seo-local-fixture-data.mjs";

/** Only the scrubbed local runner calls this with its synthetic account. */
export async function runLocalBlogApiE2E({ account, article }) {
  assert.equal(
    process.env.DATABASE_URL,
    "postgresql://phase2b_qa@127.0.0.1:55432/seo_automation_browser_20260912",
  );
  assert.equal(process.env.NEXT_PUBLIC_SITE_URL, "http://localhost:3217");
  const origin = "http://localhost:3217";
  const evidence = [];
  let cookie;
  let id;
  const slug = `seo-api-e2e-${randomUUID()}`;
  const request = async (
    path,
    { method = "GET", body, authenticated = true } = {},
  ) => {
    assert.ok(path.startsWith("/") && !path.startsWith("//"));
    const response = await fetch(`${origin}${path}`, {
      method,
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
      headers: {
        ...(authenticated && cookie ? { Cookie: cookie, Origin: origin } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return response;
  };
  const json = async (response, expected = 200) => {
    assert.equal(
      response.status,
      expected,
      `Unexpected API status ${response.status}`,
    );
    return response.json();
  };
  const latest = async () => {
    const post = await json(
      await request(`/api/posts/${id}?draft=true&depth=0`),
    );
    assert.equal(post.slug, slug);
    assert.equal(post.authorName, "Synthetic API E2E fixture");
    return post;
  };
  const action = async (name, extra = {}) => {
    const post = await latest();
    return request(`/api/admin/blog/posts/${id}`, {
      method: "POST",
      body: { action: name, expectedUpdatedAt: post.updatedAt, ...extra },
    });
  };
  try {
    const login = await request("/api/users/login", {
      method: "POST",
      body: account,
      authenticated: false,
    });
    assert.equal(login.status, 200, "Synthetic login failed");
    cookie = login.headers
      .getSetCookie()
      .find((value) => value.startsWith("payload-token="))
      ?.split(";")[0];
    assert.ok(cookie, "Synthetic session cookie missing");
    const created = await json(
      await request("/api/posts?draft=true", {
        method: "POST",
        body: {
          slug,
          titleNo: `Syntetisk API-kontroll av takvask ${slug.slice(-6)}`,
          contentNo: article.content,
          excerptNo: article.excerpt,
          seoTitleNo: article.seoTitle,
          seoDescriptionNo: article.seoDescription,
          primaryKeyword: article.primaryKeyword,
          sources: article.sources,
          ...fixtureMetadataPatch(
            { slug: "seo-local-draft", authorName: "Synthetic local fixture" },
            article,
          ),
          authorName: "Synthetic API E2E fixture",
          aiAssisted: true,
          editorialStatus: "human_review",
          _status: "draft",
        },
      }),
      201,
    );
    id = created.doc.id;
    assert.ok(Number.isInteger(id));
    const initial = await latest();
    assert.equal(
      (await action("approve")).status,
      409,
      "Unchecked fixture must not approve",
    );
    const save = await json(
      await action("save", {
        titleNo: initial.titleNo,
        contentNo: initial.contentNo,
        excerptNo: initial.excerptNo,
        seoTitleNo: initial.seoTitleNo,
        seoDescriptionNo: initial.seoDescriptionNo,
        primaryKeyword: initial.primaryKeyword,
      }),
    );
    assert.equal(
      save.qualityPassed,
      true,
      "Unique fixture must pass real quality evaluation",
    );
    await json(
      await action("approve", { reviewerName: "Synthetic API reviewer" }),
    );
    const date1 = new Date(Date.now() + 86400000).toISOString();
    const date2 = new Date(Date.now() + 172800000).toISOString();
    await json(await action("schedule", { scheduledAt: date1 }));
    await json(await action("schedule", { scheduledAt: date2 }));
    assert.equal(
      (await json(await action("schedule", { scheduledAt: date2 }))).outcome,
      "unchanged",
    );
    await json(await action("publish"));
    evidence.push("current-QA/approve/reschedule/manual-publish API PASS");
    const publicPath = `/no/blogg/${slug}`;
    assert.equal(
      (await request(publicPath, { authenticated: false })).status,
      200,
    );
    assert.ok(
      (
        await (await request("/no/blogg", { authenticated: false })).text()
      ).includes(slug),
    );
    assert.ok(
      (
        await (await request("/sitemap.xml", { authenticated: false })).text()
      ).includes(slug),
    );
    const versions = await json(
      await request(
        `/api/posts/versions?where[parent][equals]=${id}&limit=20&depth=0`,
      ),
    );
    const publishedVersion = versions.docs.find(
      (version) => version.version._status === "published",
    );
    assert.ok(publishedVersion, "Published history missing");
    await json(await action("unpublish"));
    assert.equal(
      (await request(publicPath, { authenticated: false })).status,
      404,
      "Warmed article must disappear immediately",
    );
    assert.ok(
      !(
        await (await request("/no/blogg", { authenticated: false })).text()
      ).includes(slug),
      "Public list retained unpublished fixture",
    );
    assert.ok(
      !(
        await (await request("/sitemap.xml", { authenticated: false })).text()
      ).includes(slug),
      "Warmed sitemap retained unpublished fixture",
    );
    evidence.push(
      "warm article/list/sitemap -> unpublish -> immediate removal API PASS",
    );
    await json(
      await request(`/api/posts/versions/${publishedVersion.id}?draft=false`, {
        method: "POST",
      }),
    );
    const restored = await latest();
    for (const field of [
      "qualityChecks",
      "qualityScore",
      "reviewerName",
      "reviewedAt",
      "scheduledAt",
    ])
      assert.equal(restored[field], null);
    assert.equal(restored._status, "draft");
    assert.equal(restored.editorialStatus, "human_review");
    assert.equal((await action("publish")).status, 409);
    assert.equal(
      (await request(publicPath, { authenticated: false })).status,
      404,
    );
    evidence.push(
      "native history restore -> unpublished/review-required; new publish blocked API PASS",
    );
    console.log(
      JSON.stringify({
        kind: "LOCAL_API_E2E",
        ok: true,
        postId: id,
        slug,
        evidence,
        browserAcceptance: "NOT_TESTED",
      }),
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        kind: "LOCAL_API_E2E",
        ok: false,
        postId: id,
        slug,
        evidence,
        error:
          error instanceof Error
            ? error.message.slice(0, 300)
            : "Local API failure",
        browserAcceptance: "NOT_TESTED",
      }),
    );
    process.exitCode = 1;
  } finally {
    // Only this run's freshly created and re-verified synthetic post is withdrawn.
    // Retain all versions for diagnosis; never touch fixture3 or delete anything.
    if (id && cookie) {
      const response = await action("unpublish");
      assert.equal(
        response.status,
        200,
        "Synthetic fixture cleanup requires attention",
      );
    }
  }
}
