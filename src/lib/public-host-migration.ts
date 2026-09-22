export const CANONICAL_PUBLIC_ORIGIN = "https://takfornyelsenorge.no";

const LEGACY_PUBLIC_HOSTS = new Set(["takfornyelse.as", "www.takfornyelse.as"]);

const NEW_WWW_HOST = "www.takfornyelsenorge.no";
const SAFE_REDIRECT_METHODS = new Set(["GET", "HEAD"]);
const OPERATIONAL_PATH_PREFIXES = [
  "/api",
  "/admin",
  "/admin-v2",
  "/admin-next-preview",
  "/user",
  "/payload",
  "/media",
  "/_next",
  "/_vercel",
];

function isOperationalPath(pathname: string) {
  return OPERATIONAL_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function publicHostRedirectTarget(input: {
  url: string;
  method: string;
  enabled: boolean;
}) {
  if (!SAFE_REDIRECT_METHODS.has(input.method.toUpperCase())) {
    return null;
  }

  const source = new URL(input.url);
  const hostname = source.hostname.toLowerCase();
  const canonical = new URL(CANONICAL_PUBLIC_ORIGIN);
  const canonicalHost = hostname === canonical.hostname;
  const legacyHost = LEGACY_PUBLIC_HOSTS.has(hostname);
  const newWwwHost = hostname === NEW_WWW_HOST;
  const canonicalRoot = canonicalHost && source.pathname === "/";

  const redirectHost = newWwwHost || (input.enabled && legacyHost);

  if ((!redirectHost && !canonicalRoot) || isOperationalPath(source.pathname)) {
    return null;
  }

  const target = new URL(source.toString());
  target.protocol = canonical.protocol;
  target.hostname = canonical.hostname;
  target.port = canonical.port;
  if (source.pathname === "/") target.pathname = "/no";
  return target;
}

export function migrationRedirectsEnabled(environment = process.env) {
  return (
    environment.PUBLIC_HOST_REDIRECTS_ENABLED?.trim().toLowerCase() === "true"
  );
}

export function canonicalLegacyDestination(
  destination: string,
  enabled = migrationRedirectsEnabled(),
) {
  if (!enabled || !destination.startsWith("/")) return destination;
  return new URL(destination, `${CANONICAL_PUBLIC_ORIGIN}/`).toString();
}
