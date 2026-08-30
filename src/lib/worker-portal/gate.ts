import { featureReadiness, type Environment } from "@/lib/platform/features";

export const workerPrivateNoStoreHeaders = {
  "Cache-Control": "private, no-store",
} as const;

export function workerPortalAvailable(environment: Environment = process.env) {
  return featureReadiness("workerPortal", environment).ready;
}
