# HTTP V2 — testing contract

[Package README](../../projects/http/README.md)

Use native Angular HTTP testing tools:

```ts
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRiviniaHttp, RiviniaHttp } from '@rivinia/http';

TestBed.configureTestingModule({
  providers: [provideHttpClient(), provideHttpClientTesting(), provideRiviniaHttp()],
});
const http = TestBed.inject(RiviniaHttp);
const requests = TestBed.inject(HttpTestingController);
```

Critical regressions: 200 with business error remains a value, multilingual nested arrays remain untouched, actual 4xx remain `HttpErrorResponse`, generic `request` forwards event/response/headers, QUERY sends the real method, reactive params cancel obsolete requests, and no automatic interceptors, retry or envelope handling appear.

The V2 source candidate has not yet passed the user's Angular build, Browser/SSR E2E or packed consumer gates; these must be run locally before sign-off.
