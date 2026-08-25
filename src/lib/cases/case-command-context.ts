import { AsyncLocalStorage } from "node:async_hooks";

export type TrustedCaseCommandContext = {
  expectedCaseRevision: number;
  trustedCaseCommand: true;
};

const storageSymbol = Symbol.for("takfornyelse.trusted-case-command-context");
const sharedGlobal = globalThis as typeof globalThis & {
  [storageSymbol]?: AsyncLocalStorage<TrustedCaseCommandContext>;
};

const trustedCaseCommandStorage = sharedGlobal[storageSymbol]
  ?? new AsyncLocalStorage<TrustedCaseCommandContext>();

sharedGlobal[storageSymbol] = trustedCaseCommandStorage;

export function currentTrustedCaseCommandContext() {
  return trustedCaseCommandStorage.getStore();
}

export function runTrustedCaseCommand<T>(
  context: TrustedCaseCommandContext,
  operation: () => T,
) {
  return trustedCaseCommandStorage.run(context, operation);
}
