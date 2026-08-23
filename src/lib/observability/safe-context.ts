const sensitiveKeyPattern =
  /address|authorization|cookie|email|name|password|phone|secret|signature|token/i;

export function redactContext(
  context: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => {
      if (sensitiveKeyPattern.test(key)) return [key, "[REDACTED]"];
      if (Array.isArray(value)) return [key, `[array:${value.length}]`];
      if (value && typeof value === "object") return [key, "[object]"];
      if (typeof value === "string" && value.length > 200) {
        return [key, `${value.slice(0, 197)}...`];
      }
      return [key, value];
    }),
  );
}
