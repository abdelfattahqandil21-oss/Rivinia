# HTTP V2 — migration and breaking changes (candidate)

**Not yet released.** The dependency manifest version is unchanged. This document records the proposed breaking change on branch `http/v.2`.

| Earlier contract | V2 decision | Consumer action |
| --- | --- | --- |
| `unwrap: true, unwrapKey: 'data'` | Removed from all methods | Declare the actual backend envelope type; read `.data` in the feature if needed |
| `envelope` global/per-request | Removed | Validate business success inside the consuming feature or an app-owned interceptor |
| `unwrapAs`, `extractKey` | Removed from public package API | Perform extraction in app code, preferably with a schema/parser when untrusted |
| Former error classes (RiviniaHttpEnvelopeError, RiviniaHttpUnwrapError) | Removed | Use native Angular `HttpErrorResponse` or application errors |
| `provideRiviniaHttp({ httpFeatures: [...] })` | Removed | Use `provideHttpClient(withInterceptors(...))` next to `provideRiviniaHttp()` |
| `getResource({ parse })` | Kept | Parser receives the **raw** response body, not an auto-unwrapped payload |
| Full response only for GET/POST shortcuts | `request()` supports all methods | Use `request<T>('PATCH', url, { observe: 'response' })` |
| No QUERY convenience | `query<T>(url, body?, opts?)` | Requires server/proxy and CORS support; uses `HttpClient.request('QUERY', ...)` |

## Example: preserve an envelope without interpreting it

```ts
interface ApiResponse<T> { isSuccess?: boolean; data?: T; errors?: unknown }

const response$ = http.get<ApiResponse<Ticket[]>>('/api/tickets');
// Consumers decide how to handle errors and empty results.
```

## Non-goals

No default base URL, SSR fallback heuristics, global toast, automatic retries, auth, parsing/validation, or cache engine.

## Release gate

Before sign-off: verified TypeScript API, unit tests, schematics, production package build, browser E2E if needed, SSR smoke, fresh packed independent consumer, and bundle-size baseline. No version bump, publish, merge, or push without explicit authorization.
