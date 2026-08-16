import { getPayload as getPayloadInstance } from "payload";

export const getPayload = async () => {
  if (process.env.PAYLOAD_BUILD_WITHOUT_DB === "1") {
    throw new Error("CMS access disabled for database-independent build check");
  }

  // Load the database adapter only when CMS access is actually needed. Public
  // pages can then use their static fallback content if the CMS is unavailable.
  const { default: config } = await import("@payload-config");

  return getPayloadInstance({ config });
};
