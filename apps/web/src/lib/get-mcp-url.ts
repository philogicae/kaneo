/**
 * Resolves the built-in HTTP MCP endpoint of the instance.
 *
 * When VITE_API_URL is set the API is hosted separately, so its origin is the
 * authoritative MCP base. Otherwise the deployment is same-origin and the API
 * is reachable under /api on the current web origin — deriving it from
 * window.location keeps copied configs valid on the deployed instance instead
 * of leaking the build-time localhost default.
 */
export function getMcpUrl(): string {
  const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
  if (configuredApiUrl) {
    const base = configuredApiUrl.replace(/\/+$/, "");
    return base.endsWith("/api") ? `${base}/mcp` : `${base}/api/mcp`;
  }

  return `${window.location.origin}/api/mcp`;
}
