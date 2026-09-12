// Run explicitly AFTER the approved guarded Next build. Reads generated output only.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
const root = new URL("../", import.meta.url);
const readJson = (name) =>
  JSON.parse(readFileSync(new URL(name, root), "utf8"));

test("guarded build does not emit a cached fallback sitemap", () => {
  const manifest = readJson(".next/prerender-manifest.json");
  assert.equal(manifest.routes["/sitemap.xml"], undefined);
  assert.equal(manifest.dynamicRoutes["/sitemap.xml"], undefined);
  assert.equal(
    existsSync(new URL(".next/server/app/sitemap.xml.body", root)),
    false,
  );
});

test("sitemap remains a deployed runtime metadata handler", () => {
  const paths = readJson(".next/server/app-paths-manifest.json");
  assert.equal(paths["/sitemap.xml/route"], "app/sitemap.xml/route.js");
  assert.ok(
    existsSync(new URL(`.next/server/${paths["/sitemap.xml/route"]}`, root)),
  );
});
