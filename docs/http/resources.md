# Reactive resources

Load data with reactive HTTP resources.

[Back to @rivinia/http README](https://github.com/abdelfattahqandil21-oss/Rivinia/blob/http/v1.0.1/projects/http/README.md)

## Reactive resources

`getResource` uses Angular's `httpResource`. The endpoint can be a string, a
signal, or a reactive function; `undefined` disables the request. URL,
`params`, `headers`, and `context` can be reactive inputs and trigger a new
request when their signal values change. Other options are read once when
the resource is created.

```ts
import { Component, signal } from '@angular/core';
import { injectRiviniaHttp, joinUrl } from '@rivinia/http';
import { environment } from '../environments/environment';

import type { Trip } from './trip.service';

@Component({
  selector: 'app-trip-list',
  templateUrl: './trip-list.component.html',
})
export class TripListComponent {
  private readonly http = injectRiviniaHttp();
  readonly page = signal(1);
  readonly trips = this.http.getResource<Trip[]>(joinUrl(environment.apiUrl, 'trips'), {
    params: () => ({ page: this.page() }),
    unwrap: true,
    unwrapKey: 'data',
  });

  nextPage(): void {
    this.page.update((value) => value + 1);
  }
}
```

```html
<!-- src/app/trip-list.component.html -->
@if (trips.isLoading()) {
<p>Loading trips…</p>
} @else if (trips.hasValue()) {
<ul>
  @for (trip of trips.value(); track trip.id) {
  <li>{{ trip.title }} — {{ trip.departureDate }} ({{ trip.status }})</li>
  }
</ul>
} @else if (trips.error()) {
<p role="alert">Could not load trips. Try again.</p>
}
<button type="button" (click)="nextPage()">Next page</button>
```

In a real app, share the Trip model through a model module. `parse` is optional;
when provided it runs after envelope validation and unwrapping, and can perform
runtime validation (for example with Zod or Valibot). A parse error, HTTP
error, or library envelope error is exposed through `trips.error()`.
`defaultValue` supplies a value while idle/loading. `reportProgress` is
forwarded to the resource request; for progress events on an `Observable`,
use Angular `HttpClient` directly.

## Resource context and native configuration

The endpoint callback receives Angular's `ResourceParamsContext` so dependent
resources can use the native `chain` operation:

```ts
readonly account = this.http.getResource<{ id: string }>('/api/account');
readonly orders = this.http.getResource<Order[]>((ctx) => {
  const account = ctx.chain(this.account);
  return account ? `/api/accounts/${account.id}/orders` : undefined;
});
```

The callback runs inside Angular's request evaluation. Status propagation,
cancellation and reload behavior remain Angular's responsibility; this wrapper
does not introduce a separate scheduler or cache.

`injector`, `equal`, and `debugName` are forwarded to native resource options.
Use an explicit `injector` to create a resource outside an active injection
context. A supplied `defaultValue` removes the implicit `undefined` from the
return type (an explicitly nullable default retains `null`). Existing undefined
endpoints still disable the resource. Guard errored resource values with
`hasValue()` before reading them.

```ts
const users = api.getResource<User[]>('/api/users', {
  injector,
  defaultValue: [],
  debugName: 'users',
  equal: (previous, next) => previous === next,
  timeout: 5000,
  transferCache: false,
});
// users.value() is User[], with no implicit undefined.
```

Both Observable methods and resources forward native transport options:
`withCredentials`, `timeout`, `transferCache`, `keepalive`, `cache`, `credentials`,
`priority`, `mode`, `redirect`, `referrer`, `referrerPolicy`, and `integrity`.
These retain Angular/backend semantics; fetch-specific controls do not add XHR
capabilities. `cache` configures browser HTTP caching, not shared application
query caching. Timeout is the backend request timeout, not a whole-interceptor-chain
deadline. No automatic retries are added. Per-resource transport settings are read
once; URL, params, headers and context retain their reactive behavior.

Query parameter objects accept readonly arrays of primitive values. Arrays become
repeated keys; empty arrays and null/undefined entries are omitted:

```ts
api.get('/api/users', { params: { role: ['admin', 'editor'], unused: [], cursor: null } });
// role=admin&role=editor
```

These are additive changes for the next library release. HTTP QUERY remains
outside this implementation until its framework API is stable.
