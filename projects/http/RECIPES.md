# HTTP recipes — consumer responsibilities

`@rivinia/http` is a raw transport facade. All examples below live in the consuming app, not in the package's runtime.

## Business result adaptation (example only)

```ts
import { map } from 'rxjs';
interface ApiResponse<T> { data?: T; error?: unknown }
const tickets$ = http.get<ApiResponse<Ticket[]>>('/api/tickets').pipe(
  map(body => body.error ? [] : body.data ?? []),
);
```

Only implement this rule if **your backend contract** explicitly says an `error` response means an empty ticket collection. For payments and validation, do not convert failures to empty data. Keep all error translations/presentation in the feature or application.

## Application-owned retry (idempotent reads only)

```ts
import { retry } from 'rxjs';
const read$ = http.get('/api/config').pipe(retry({ count: 2, delay: 500 }));
```

Do not retry payment or booking mutations without an application-approved idempotency strategy. Global retry, token refresh, error UI, loading indicators, telemetry, caching and TanStack Query integration stay outside the core.

## Resource reload after a mutation

```ts
http.post('/api/tickets', newTicket).subscribe(() => ticketsResource.reload());
```

Use plain Observables for mutations; Angular `httpResource` is for reactive reads.

## Cancellation of obsolete filter requests

```ts
import { switchMap } from 'rxjs';
const results$ = filterChanges$.pipe(switchMap(filter =>
  http.get('/api/tickets', { params: filter }),
));
```

This is an application policy, and is different from caching or deduplication.
