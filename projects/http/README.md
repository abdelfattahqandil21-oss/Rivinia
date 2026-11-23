# @rivinia/http — V2 transport-first candidate

**Status:** local design/build candidate on `http/v.2`. Not a released package or a readiness sign-off.

An Angular-native HTTP facade that does not interpret backend response shapes. Uses native `HttpClient` and `httpResource`; the application owns its response formats, interceptors, error policies and server state.

## Beginner — a raw typed response

```ts
import { provideHttpClient } from '@angular/common/http';
import { provideRiviniaHttp } from '@rivinia/http';

export const appConfig = {
  providers: [provideHttpClient(), provideRiviniaHttp()],
};
```

```ts
import { Service } from '@angular/core';
import { injectRiviniaHttp } from '@rivinia/http';

interface Ticket { id: number; status: string }
interface TicketsResponse { data?: Ticket[][]; error?: unknown }

@Service()
export class TicketsApi {
  private readonly http = injectRiviniaHttp();
  find(date: string) {
    return this.http.get<TicketsResponse>('/api/tickets', { params: { date } });
  }
}
```

`TicketsResponse` is an application-defined TypeScript assertion, not runtime validation. A `200` with `{ error: ... }` remains an emitted value; `data` and nested arrays are not unwrapped or flattened.

## Intermediate — domain interpretation in the consumer

```ts
import { map } from 'rxjs';

const tickets$ = api.find('2026-11-23').pipe(
  map(response => {
    if (response.error) return { kind: 'empty' as const, reason: response.error };
    return { kind: 'data' as const, value: response.data ?? [] };
  }),
);
```

This policy is illustrative, **not** a universal rule: a booking or payment backend might treat the same `error` field as a failed operation. The HTTP library never decides business meaning.

## Advanced — native response metadata, events, custom methods

```ts
const details$ = http.request<{ id: number }>('PATCH', '/api/tickets/3', {
  body: { status: 'checked' }, observe: 'response',
}); // Observable<HttpResponse<{ id: number }>>

const events$ = http.request<unknown>('POST', '/api/upload', {
  body: formData, observe: 'events', reportProgress: true,
}); // Observable<HttpEvent<unknown>>

const search$ = http.query<TicketsResponse>('/api/tickets/query', {
  cityIds: [10, 12], day: '2026-11-23',
}); // Sends the QUERY verb via Angular request('QUERY')
```

`QUERY` requires server/proxy support and may trigger CORS preflight. This facade does **not** promise Angular 22.3 QUERY-specific SSR transfer-cache behavior on Angular 22.2.

## Deep — reactive GET / SSR / Angular interop

```ts
readonly date = signal('2026-11-23');
readonly tickets = http.getResource<TicketsResponse>('/api/tickets', {
  params: () => ({ date: this.date() }),
}); // native HttpResourceRef with cancellation and reload
```

You can supply `parse: (raw: unknown) => T` for consumer-owned validation. Resource values remain raw unless **the consumer** supplies `parse`.

Transport controls including `HttpContext`, headers, timeout, transfer cache and fetch-related settings are forwarded; compatibility follows Angular's chosen backend (XHR/fetch). Neither retries, auth, caching, business error mapping nor global UI notifications are installed here.

## Public API summary

- `RiviniaHttp`: `get`, `post`, `put`, `patch`, `delete`, `request`, `query`, `getBlob`, `getText`, `getResponse`, `postResponse`, `getResource`.
- `provideRiviniaHttp()`, `injectRiviniaHttp()`, `joinUrl()` and native request/resource option types.
- `provideHttpClient(...)` belongs to the application; `ng add` adds both providers conservatively.
- No `unwrap`, `unwrapKey`, `RiviniaEnvelopePolicy`, `unwrapAs` or implicit error interpretation in V2.

## Compatibility / release

Existing manifest `2.0.0-alpha.1` and peer constraints remain **unchanged**. Removing V1 response handling is an intentional breaking design change for this local V2 candidate; no publish or version bump is authorized. Consumer migration is described in `docs/http/v2-migration.md`.

[API reference](../../docs/http/api.md) · [Transport behavior](../../docs/http/envelopes-and-errors.md) · [Resources](../../docs/http/resources.md) · [Testing](../../docs/http/testing.md)
