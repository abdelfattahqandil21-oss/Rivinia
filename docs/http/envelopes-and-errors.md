# Backend responses and errors — V2

## Rule

**HTTP transport status is not a business decision.** Rivinia emits successful HTTP response bodies exactly as received. It does not inspect `isSuccess`, `isValid`, `error`, or `errors`. A `200` with an error array is a value; a `4xx` remains Angular's `HttpErrorResponse`. A raw array or array of arrays is never flattened.

```ts
interface TicketResponse {
  data?: Ticket[][];
  error?: unknown;
}

const response$ = http.get<TicketResponse>('/api/tickets');
// Possible 200 payload:
// { error: [[{ ar: 'لا توجد تذاكر', en: 'No tickets' }]] }
```

The generic `TicketResponse` only describes a compile-time expectation. It does not prove what the server sent. To validate an untrusted response, use consumer-owned `map`, a parser (Zod/Valibot/etc.) or an OpenAPI-generated contract.

```ts
import { map } from 'rxjs';

const result$ = http.get<unknown>('/api/tickets').pipe(
  map(raw => parseMyTicketsResponse(raw)),
);
```

In reactive `getResource`, the same consumer-owned parser can be passed as `parse: (raw: unknown) => T`, and Angular surfaces parsing failures via `resource.error()`.

## Ownership boundary

- Rivinia: HTTP method, options, params, native response modes, resources.
- Angular: HTTP errors, SSR transport/caching, cancellation and interceptors.
- Consumer: business failures vs empty states, localized messages, field validation, retry policy, auth, toast UI.

## Migration

V1 `unwrap`, `unwrapKey`, `envelope`, `unwrapAs`, `RiviniaHttpEnvelopeError` and `RiviniaHttpUnwrapError` have no equivalent automatic behavior in the V2 core. See [migration notes](v2-migration.md). Do not silently restore this behavior with a default policy.
