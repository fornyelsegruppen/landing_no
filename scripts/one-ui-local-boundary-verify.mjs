// Reproduce Next's server-only marker resolution for this Node-only reader.
// Real admin authorization and read-only transactions are not mocked.
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, next) {
    return next(
      specifier === "server-only"
        ? "next/dist/compiled/server-only/empty.js"
        : specifier,
      context,
    );
  },
});
await import("./one-ui-local-boundary-verify.ts");
