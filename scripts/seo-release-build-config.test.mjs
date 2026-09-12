// Source-contract and disabled-helper checks. No build, remote CLI, or DB call.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { runPreflight } from "./db-compat/preflight.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const base = "051260e536dfe06b2d757eb9f764dba5367b7d6d";
const liveSource = "414f65f555895552c5905553330b0d2b1dc72828";
const command =
  "node scripts/db-compat/preflight.mjs && PAYLOAD_BUILD_WITHOUT_DB=1 next build --webpack";
const read = (name) =>
  readFileSync(new URL(`../${name}`, import.meta.url), "utf8").replace(
    /\r\n/g,
    "\n",
  );
const git = (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
const at = (revision, name) => git("show", `${revision}:${name}`);
const config = JSON.parse(read("vercel.json"));
const originalConfig = JSON.parse(at(base, "vercel.json"));

function assertReleaseConfig(candidate) {
  const { buildCommand, ...rest } = candidate;
  assert.equal(buildCommand, command);
  assert.deepEqual(rest, originalConfig);
}

test("tracked build runs default-OFF preflight before guarded direct Next", () => {
  assertReleaseConfig(config);
});

test("unsafe or unguarded build substitutions fail the contract", () => {
  for (const buildCommand of [
    "npm run build",
    "npm run build:migrate && next build",
    "next build --webpack",
    "PAYLOAD_BUILD_WITHOUT_DB=1 npm run build",
    "PAYLOAD_BUILD_WITHOUT_DB=1 next build --webpack",
    "SEO_DB_COMPAT_PREFLIGHT=1 " + command,
    command.replace(" && ", " ; "),
    command.replace(" && ", " || "),
  ]) {
    assert.throws(() => assertReleaseConfig({ ...config, buildCommand }));
  }
});

test("cron definitions and runtime env overrides cannot be changed silently", () => {
  assert.deepEqual(config.crons, originalConfig.crons);
  assert.throws(() => assertReleaseConfig({ ...config, crons: [] }));
  assert.throws(() =>
    assertReleaseConfig({ ...config, env: { PAYLOAD_BUILD_WITHOUT_DB: "1" } }),
  );
  assert.throws(() =>
    assertReleaseConfig({ ...config, env: { SEO_DB_COMPAT_PREFLIGHT: "1" } }),
  );
  assert.throws(() =>
    assertReleaseConfig({
      ...config,
      build: { env: { FEATURE_AI_DRAFTS: "true" } },
    }),
  );
});

test("normal build preflight is disabled without credential/file/driver IO", async () => {
  assert.equal(
    config.buildCommand.split(" && ")[0],
    "node scripts/db-compat/preflight.mjs",
  );
  assert.doesNotMatch(config.buildCommand, /SEO_DB_COMPAT_PREFLIGHT=/);
  for (const flag of [undefined, "0", "false"]) {
    const environment = new Proxy(
      {},
      {
        get: (_target, key) => {
          assert.equal(key, "SEO_DB_COMPAT_PREFLIGHT");
          return flag;
        },
      },
    );
    const noIO = async () => assert.fail("disabled helper must not perform IO");
    const logs = [];
    assert.equal(
      await runPreflight({
        environment,
        load: noIO,
        createClient: noIO,
        log: (message) => logs.push(message),
      }),
      0,
    );
    assert.deepEqual(logs, ["DB_COMPAT_DISABLED"]);
  }
});

test("diagnostics preserve accepted SQL capture, sealed manifest and local harness verbatim", () => {
  for (const name of [
    "capture.mjs",
    "manifest.json",
    "local-check.mjs",
  ]) {
    const file = `scripts/db-compat/${name}`;
    assert.equal(
      read(file),
      at("523fe868200ad37039fc37241def2831f3ceec23", file),
    );
  }
});

test("package lifecycle and explicit migration policy remain untouched", () => {
  for (const name of [
    "package.json",
    "package-lock.json",
    "scripts/run-migrate.mjs",
  ]) {
    assert.equal(read(name), at(base, name));
  }
  const { scripts } = JSON.parse(read("package.json"));
  assert.equal(scripts.build, "npm run build:migrate && next build");
  for (const hook of ["preinstall", "install", "postinstall", "prepare"]) {
    assert.equal(scripts[hook], undefined);
  }
});

test("existing CMS/auth build guards and production schema protections are preserved", () => {
  for (const name of [
    "src/lib/payload.ts",
    "src/lib/auth/internal-session.ts",
    "src/lib/payload-database-safety.ts",
    "src/payload.config.ts",
    "next.config.ts",
  ]) {
    assert.equal(read(name), at(base, name));
  }
  assert.match(read("src/lib/payload.ts"), /PAYLOAD_BUILD_WITHOUT_DB === "1"/);
  assert.match(
    read("src/lib/auth/internal-session.ts"),
    /PAYLOAD_BUILD_WITHOUT_DB === "1"/,
  );
  const payloadConfig = read("src/payload.config.ts");
  assert.match(payloadConfig, /disableCreateDatabase: true/);
  assert.match(payloadConfig, /push: process\.env\.NODE_ENV !== "production"/);
  assert.doesNotMatch(payloadConfig, /prodMigrations:/);
});

test("reviewed application has no migration/config/generated-type delta from live source", () => {
  assert.equal(
    git(
      "diff",
      "--name-only",
      liveSource,
      base,
      "--",
      "src/payload/migrations",
      "src/payload.config.ts",
      "src/payload/payload-types.ts",
      "package-lock.json",
    ),
    "",
  );
  const changedCollections = git(
    "diff",
    "--name-only",
    liveSource,
    base,
    "--",
    "src/payload/collections",
  )
    .trim()
    .split(/\r?\n/)
    .filter(
      (name) => name && !name.includes(".test.") && !name.includes(".qa.test."),
    );
  assert.deepEqual(changedCollections, ["src/payload/collections/Posts.ts"]);
  const fields = (revision) => {
    const source = at(revision, "src/payload/collections/Posts.ts");
    const offset = source.indexOf("  fields: [");
    assert.ok(offset > 0);
    return source.slice(offset);
  };
  assert.equal(fields(liveSource), fields(base));
});
