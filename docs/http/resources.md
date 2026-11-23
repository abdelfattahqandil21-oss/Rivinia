# HTTP V2 — native reactive resources

[Package README](../../projects/http/README.md)

`getResource<T>` delegates to Angular `httpResource`. It exposes native resource loading state, error, cancellation, reload and value signals. It is intended for reactive **reads**, not mutation requests.

```ts
import { signal } from '@angular/core';
import { injectRiviniaHttp } from '@rivinia/http';

interface Ticket { id: number }
interface TicketsResponse { data?: Ticket[][]; errors?: unknown }
class TicketsView {
  private readonly http = injectRiviniaHttp();
  readonly date = signal('2026-11-23');
  readonly tickets = this.http.getResource<TicketsResponse>('/api/tickets', {
    params: () => ({ date: this.date() }),
  });
}
```

Results, including `errors` or nested arrays, remain raw unless the consumer supplies `parse`:

```ts
const tickets = http.getResource<Ticket[]>('/api/tickets', {
  parse: (raw: unknown) => myTicketParser(raw),
  defaultValue: [],
});
```

## Native forwarding

- `endpoint` accepts a string, signal, or callback taking `ResourceParamsContext`; `undefined` disables the request.
- `params`, `headers`, `context` accept values, signals or reactive callbacks.
- `defaultValue` gives a defined resource value type (including explicit null); `injector`, `equal`, `debugName` use Angular native options.
- `reportProgress`, timeout, transfer cache, credentials and fetch controls are forwarded; their actual behavior depends on Angular and the backend.
- When the endpoint or reactive inputs change, Angular owns request cancellation and latest-value semantics.
- SSR/hydration reuse depends on Angular TransferState and the application's SSR setup. No V2-specific SSR cache layer is installed.

```ts
const parent = http.getResource<{ id: string }>('/api/account');
const child = http.getResource((ctx) => {
  const account = ctx.chain(parent);
  return account ? `/api/accounts/${account.id}/tickets` : undefined;
});
```

For non-JSON responses, use the native Angular `httpResource.text`, `.blob` or `.arrayBuffer` if needed; this V2 facade only wraps JSON resources to keep its surface small.
