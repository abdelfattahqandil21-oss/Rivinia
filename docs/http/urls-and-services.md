# HTTP V2 — URLs and feature services

[Package README](../../projects/http/README.md)

Install `@rivinia/http` and run `ng add @rivinia/http` for a conservative app-config change; or register the two providers manually:

```ts
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRiviniaHttp } from '@rivinia/http';

providers: [
  provideHttpClient(withInterceptors([authInterceptor])),
  provideRiviniaHttp(),
]
```

Rivinia does not register the HTTP backend and has no `httpFeatures` option. Angular owns all interceptors. The `ng add` schematic inserts providers only when it can locate a supported standalone `app.config.ts`. It leaves unknown layouts alone.

## URLs

URLs are transmitted exactly as supplied. `joinUrl` only composes a base/path boundary; it is not a URL parser and does not solve arbitrary query strings and fragments. For complex URL composition, use the standard `URL` API.

```ts
const endpoint = joinUrl(environment.apiUrl, 'tickets');
```

## Consumer-owned response contracts

```ts
import { Service } from '@angular/core';
import { injectRiviniaHttp, joinUrl } from '@rivinia/http';
import { environment } from '../environments/environment';

interface Ticket { id: number }
interface SearchResponse { data?: Ticket[][]; error?: unknown }

@Service()
export class TicketApi {
  private readonly http = injectRiviniaHttp();
  private readonly url = joinUrl(environment.apiUrl, 'tickets');

  find(date: string) {
    return this.http.get<SearchResponse>(this.url, { params: { date } });
  }

  create(body: unknown) {
    return this.http.post<unknown>(this.url, body);
  }

  readCount() {
    return this.http.request<SearchResponse>('GET', this.url, { observe: 'response' });
  }

  query(filters: unknown) {
    return this.http.query<SearchResponse>(joinUrl(this.url, 'query'), filters);
  }
}
```

No automatic extraction of `.data` and no assumption about the semantics of `error` or `isSuccess`. For backend-specific mapping, use RxJS `map` in the feature service. `HttpContext` is forwarded directly to app interceptors. Request params accept readonly arrays of strings/numbers/booleans as repeated keys and drop nullish entries.
