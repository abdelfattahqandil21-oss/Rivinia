/**
 * Join a base URL with a relative endpoint at their slash boundary.
 * Absolute http(s) endpoints are passed through unchanged.
 * Not a URL parser: for query/fragment-aware construction, prefer `URL`.
 */
export function joinUrl(baseUrl: string, endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  const base = baseUrl.replace(/\/+$/, '');
  const path = endpoint.replace(/^\/+/, '');
  return path ? `${base}/${path}` : base;
}
