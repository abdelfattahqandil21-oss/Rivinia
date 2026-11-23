# HTTP V2 public API — working contract

[Package README](../../projects/http/README.md)

## Core

| Export | Responsibility |
| --- | --- |
| `provideRiviniaHttp()` | Adds the facade provider; does **not** configure Angular HttpClient or interceptors |
| `injectRiviniaHttp()` | Inject the facade in an injection context |
| `RiviniaHttp` | Native JSON methods, typed `request`, QUERY, raw text/blob and reactive GET resources |
| `joinUrl(base, endpoint)` | Optional boundary-slash path utility; not a complete URL parser |
| `RiviniaRequestBase` / `RiviniaRequestOptions` | Native headers, params, context and transport controls |
| `RiviniaDeleteRequestOptions` | Native request controls plus optional delete body |
| `RiviniaRawOptions` | Same transport controls for text/blob and response shortcuts |
| `RiviniaHttpRequestBase` | Transport options, body and reportProgress |
| `RiviniaHttpJsonBodyOptions` / `RiviniaHttpJsonResponseOptions` / `RiviniaHttpJsonEventsOptions` | Discriminated JSON observe contracts |
| `RiviniaHttpNonJsonOptions` | Typed text/blob/arraybuffer observe contracts |
| `RiviniaResourceEndpoint` / `RiviniaResourceOptions` | Angular reactive request controls; consumer-owned parse |
| `QueryParamsInput` / `ReactiveInput` | Repeated primitive array params / reactive values |

## Methods

| Method | Return |
| --- | --- |
| `get<T>(url, opts?)` | `Observable<T>` raw JSON body |
| `post<T>(url, body?, opts?)` | `Observable<T>` raw JSON body |
| `put<T>(url, body?, opts?)` | `Observable<T>` raw JSON body |
| `patch<T>(url, body?, opts?)` | `Observable<T>` raw JSON body |
| `delete<T>(url, opts?)` | `Observable<T>` raw JSON body |
| `query<T>(url, body?, opts?)` | `Observable<T>` raw JSON body, HTTP `QUERY` verb |
| `request<T>(method, url, opts?)` | Native typed body, full response or events; supports JSON, text, blob, arraybuffer |
| `getText(url, opts?)`, `getBlob(url, opts?)` | `Observable<string>` / `Observable<Blob>` |
| `getResponse<T>(url, opts?)`, `postResponse<T>(url, body?, opts?)` | `Observable<HttpResponse<T>>` convenience shortcuts |
| `getResource<T>(urlOrSignalOrCallback, opts?)` | Angular `HttpResourceRef<T | undefined>` or `HttpResourceRef<T>` when defaultValue supplied |

No business response normalization, unwrap, envelope, translation, auto-retry, or server-state cache in the core.

## Angular compatibility

`request('QUERY', ...)` works with the Angular 22.2 HttpClient API without requiring `HttpClient.query()` at compile time. Do not infer native QUERY-specific SSR transfer-cache behavior from this wrapper. `HttpClient` owns actual network serialization, interceptors and errors.
