import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Next resolves this marker internally. Vitest needs a no-op target while
      // production modules retain the build-time client-import guard.
      "server-only": fileURLToPath(
        new URL("./src/test/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // PGlite starts a full in-process Postgres instance. Parallel migration
    // files exhaust Windows ARM resources and create false hook timeouts.
    fileParallelism: false,
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
