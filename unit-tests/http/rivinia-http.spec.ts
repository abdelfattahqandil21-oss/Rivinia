import { HttpContext, HttpContextToken, HttpErrorResponse, HttpEventType, HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, computed, inject, signal, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { map } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideRiviniaHttp } from '../../projects/http/src/lib/providers/provide-http';
import { RiviniaHttp } from '../../projects/http/src/lib/services/rivinia-http';

@Component({ template: '' })
class ResourceConsumer {
  readonly resource = inject(RiviniaHttp).getResource('https://api.test/destroyed');
}

function setup() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRiviniaHttp()] });
  return { http: TestBed.inject(RiviniaHttp), ctrl: TestBed.inject(HttpTestingController) };
}

beforeEach(() => TestBed.resetTestingModule());

const nested = [
  [{ id: 1 }, { id: 2 }],
  [{ id: 3 }],
];
const translatedError = { error: [[{ ar: 'لا توجد تذاكر', en: 'No tickets' }]] };

describe('RiviniaHttp V2: raw HTTP semantics', () => {
  it('returns business errors with HTTP 200 unchanged, even without isSuccess', () => {
    const { http, ctrl } = setup();
    let actual: unknown;
    http.get<unknown>('/tickets?date=now').subscribe(value => actual = value);
    ctrl.expectOne('/tickets?date=now').flush(translatedError);
    expect(actual).toEqual(translatedError);
    ctrl.verify();
  });

  it('does not extract data or flatten nested arrays', () => {
    const { http, ctrl } = setup();
    const results: unknown[] = [];
    http.get<unknown>('/raw').subscribe(v => results.push(v));
    ctrl.expectOne('/raw').flush({ data: nested, total: 3 });
    http.get<unknown>('/nested').subscribe(v => results.push(v));
    ctrl.expectOne('/nested').flush(nested);
    expect(results).toEqual([{ data: nested, total: 3 }, nested]);
    ctrl.verify();
  });

  it('does not reinterpret null, false, zero or empty JSON responses', () => {
    const { http, ctrl } = setup();
    for (const value of [null, false, 0, '', []]) {
      let result: unknown = Symbol('unset');
      http.get<unknown>('/raw').subscribe(v => result = v);
      ctrl.expectOne('/raw').flush(value);
      expect(result).toEqual(value);
    }
    ctrl.verify();
  });

  it('keeps Angular HTTP 4xx errors in its native error channel', () => {
    const { http, ctrl } = setup();
    let failure: unknown;
    http.get<unknown>('/missing').subscribe({ error: error => failure = error });
    ctrl.expectOne('/missing').flush({ code: 'NO_TICKETS' }, { status: 404, statusText: 'Not found' });
    expect(failure).toBeInstanceOf(HttpErrorResponse);
    expect((failure as HttpErrorResponse).status).toBe(404);
    expect((failure as HttpErrorResponse).error).toEqual({ code: 'NO_TICKETS' });
    ctrl.verify();
  });

  it('forwards all primary HTTP verbs and payloads without conversion', () => {
    const { http, ctrl } = setup();
    const out: unknown[] = [];
    http.get('/get').subscribe(v => out.push(v));
    http.post('/post', { body: 1 }).subscribe(v => out.push(v));
    http.put('/put', { body: 2 }).subscribe(v => out.push(v));
    http.patch('/patch', { body: 3 }).subscribe(v => out.push(v));
    http.delete('/delete', { body: { reason: 'x' } }).subscribe(v => out.push(v));
    for (const verb of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      const req = ctrl.expectOne('/' + verb.toLowerCase());
      expect(req.request.method).toBe(verb);
      if (verb === 'DELETE') expect(req.request.body).toEqual({ reason: 'x' });
      req.flush({ verb, data: [1, 2] });
    }
    expect(out).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(verb => ({ verb, data: [1, 2] })));
    ctrl.verify();
  });

  it('serializes repeated array params and omits nullish and empty entries', () => {
    const { http, ctrl } = setup();
    http.get('/search', { params: { tag: ['a', 'b'], flags: [true, 2], empty: [], skip: null, unset: undefined } }).subscribe();
    const req = ctrl.expectOne(r => r.method === 'GET' && r.url === '/search');
    expect(req.request.params.getAll('tag')).toEqual(['a', 'b']);
    expect(req.request.params.getAll('flags')).toEqual(['true', '2']);
    expect(req.request.params.has('empty')).toBe(false);
    expect(req.request.params.has('skip')).toBe(false);
    expect(req.request.params.has('unset')).toBe(false);
    req.flush({});
    ctrl.verify();
  });

  it('forwards native transport controls on every shorthand path', () => {
    const { http, ctrl } = setup();
    const options = { timeout: 123, transferCache: false, cache: 'no-store' as const,
      credentials: 'include' as const, priority: 'high' as const, mode: 'cors' as const,
      redirect: 'error' as const, referrer: 'about:client', referrerPolicy: 'no-referrer' as const,
      integrity: 'sha256-example', keepalive: true };
    const calls = [http.get('/get', options), http.post('/post', {}, options),
      http.put('/put', {}, options), http.patch('/patch', {}, options), http.delete('/delete', options),
      http.getBlob('/blob', options), http.getText('/text', options),
      http.getResponse('/response', options), http.postResponse('/post-response', {}, options)];
    for (const call of calls) call.subscribe();
    const requests = ctrl.match(() => true);
    expect(requests.length).toBe(9);
    for (const req of requests) {
      for (const [key, value] of Object.entries(options)) expect(Reflect.get(req.request, key), key).toEqual(value);
      const type = req.request.responseType;
      req.flush(type === 'blob' ? new Blob() : type === 'text' ? '' : {});
    }
    ctrl.verify();
  });

  it('unsubscribing cancels the native in-flight request', () => {
    const { http, ctrl } = setup();
    const subscription = http.get('/slow').subscribe();
    const request = ctrl.expectOne('/slow');
    subscription.unsubscribe();
    expect(request.cancelled).toBe(true);
    ctrl.verify({ ignoreCancelled: true });
  });

  it('keeps blob and text bodies byte-for-byte / character-for-character', () => {
    const { http, ctrl } = setup();
    let blob: Blob | undefined;
    let text: string | undefined;
    http.getBlob('/file').subscribe(v => blob = v);
    http.getText('/note').subscribe(v => text = v);
    const raw = new Blob(['abc']);
    ctrl.expectOne('/file').flush(raw);
    ctrl.expectOne('/note').flush('{"isSuccess":false}');
    expect(blob).toBe(raw);
    expect(text).toBe('{"isSuccess":false}');
    ctrl.verify();
  });

  it('keeps full response headers/status intact for any business body', () => {
    const { http, ctrl } = setup();
    let res: HttpResponse<unknown> | undefined;
    http.getResponse<unknown>('/items').subscribe(v => res = v);
    ctrl.expectOne('/items').flush(translatedError, { headers: { 'X-Total-Count': '42' } });
    expect(res?.body).toEqual(translatedError);
    expect(res?.headers.get('X-Total-Count')).toBe('42');
    ctrl.verify();
  });

  it('generic request supports PATCH full response with headers', () => {
    const { http, ctrl } = setup();
    let res: HttpResponse<{ id: number }> | undefined;
    http.request<{ id: number }>('PATCH', '/ticket/2', { body: { status: 'paid' }, observe: 'response' }).subscribe(v => res = v);
    const req = ctrl.expectOne('/ticket/2');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'paid' });
    req.flush({ id: 2 }, { status: 200, statusText: 'OK', headers: { ETag: 'abc' } });
    expect(res?.headers.get('ETag')).toBe('abc');
    expect(res?.body).toEqual({ id: 2 });
    ctrl.verify();
  });

  it('generic request can surface HttpEvent stream and reportProgress', () => {
    const { http, ctrl } = setup();
    const types: HttpEventType[] = [];
    http.request<{ done: boolean }>('POST', '/upload', { body: 'data', observe: 'events', reportProgress: true })
      .subscribe(event => types.push(event.type));
    const req = ctrl.expectOne('/upload');
    expect(req.request.reportProgress).toBe(true);
    req.flush({ done: true });
    expect(types).toContain(HttpEventType.Response);
    ctrl.verify();
  });

  it('generic request forwards text/blob/arraybuffer responseType options', () => {
    const { http, ctrl } = setup();
    let text: unknown, blob: unknown, bytes: unknown;
    http.request('GET', '/text', { responseType: 'text' }).subscribe(v => text = v);
    http.request('GET', '/blob', { responseType: 'blob', observe: 'response' }).subscribe(v => blob = v);
    http.request('GET', '/bytes', { responseType: 'arraybuffer', observe: 'body' }).subscribe(v => bytes = v);
    ctrl.expectOne('/text').flush('message');
    const payload = new Blob(['a']);
    ctrl.expectOne('/blob').flush(payload);
    const buffer = new Uint8Array([1, 2]).buffer;
    ctrl.expectOne('/bytes').flush(buffer);
    expect(text).toBe('message');
    expect((blob as HttpResponse<Blob>).body).toBe(payload);
    expect(bytes).toBe(buffer);
    ctrl.verify();
  });

  it('QUERY sends a real QUERY method with raw body and repeated params', () => {
    const { http, ctrl } = setup();
    let result: unknown;
    const filter = { city: [1, 2], date: '2026-11-23' };
    http.query<unknown>('/tickets/search', filter, { params: { page: 1, status: ['used', 'new'] } })
      .subscribe(v => result = v);
    const req = ctrl.expectOne(r => r.method === 'QUERY' && r.url === '/tickets/search');
    expect(req.request.method).toBe('QUERY');
    expect(req.request.body).toEqual(filter);
    expect(req.request.params.getAll('status')).toEqual(['used', 'new']);
    req.flush({ results: nested });
    expect(result).toEqual({ results: nested });
    ctrl.verify();
  });

  it('application interceptors and HttpContext retain their native contracts and order', () => {
    const flag = new HttpContextToken<boolean>(() => false);
    const order: string[] = [];
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([
        (req, next) => {
          order.push('first:request');
          return next(req.clone({ setHeaders: { 'X-Flag': String(req.context.get(flag)) } })).pipe(map(e => {
            if (e instanceof HttpResponse) order.push('first:response');
            return e;
          }));
        },
        (req, next) => {
          order.push('second:request');
          return next(req).pipe(map(e => {
            if (e instanceof HttpResponse) order.push('second:response');
            return e;
          }));
        },
      ])),
      provideHttpClientTesting(), provideRiviniaHttp(),
    ] });
    const http = TestBed.inject(RiviniaHttp);
    const ctrl = TestBed.inject(HttpTestingController);
    let result: unknown;
    http.get('/intercepted', { context: new HttpContext().set(flag, true) }).subscribe(v => result = v);
    const req = ctrl.expectOne('/intercepted');
    expect(req.request.headers.get('X-Flag')).toBe('true');
    req.flush(translatedError);
    expect(result).toEqual(translatedError);
    expect(order).toEqual(['first:request', 'second:request', 'second:response', 'first:response']);
    ctrl.verify();
  });
});

describe('RiviniaHttp.getResource: native Angular reactivity', () => {
  it('renders raw envelopes, without extraction, as resource.value()', async () => {
    const { http, ctrl } = setup();
    const resource = TestBed.runInInjectionContext(() => http.getResource<unknown>('/resource'));
    TestBed.flushEffects();
    ctrl.expectOne('/resource').flush(translatedError);
    await new Promise(resolve => setTimeout(resolve, 0));
    TestBed.flushEffects();
    expect(resource.value()).toEqual(translatedError);
    ctrl.verify();
  });

  it('runs consumer parse only when explicitly configured', async () => {
    const { http, ctrl } = setup();
    const resource = TestBed.runInInjectionContext(() => http.getResource<number[]>('/parse', {
      parse: (raw) => (raw as { data: number[] }).data,
    }));
    TestBed.flushEffects();
    ctrl.expectOne('/parse').flush({ data: [1, 2] });
    await new Promise(resolve => setTimeout(resolve, 0));
    TestBed.flushEffects();
    expect(resource.value()).toEqual([1, 2]);
    ctrl.verify();
  });

  it('a consumer parse failure surfaces through native resource.error()', async () => {
    const { http, ctrl } = setup();
    const resource = TestBed.runInInjectionContext(() => http.getResource('/bad', {
      parse: () => { throw new Error('consumer validation failed'); },
    }));
    TestBed.flushEffects();
    ctrl.expectOne('/bad').flush({ unexpected: true });
    await new Promise(resolve => setTimeout(resolve, 0));
    TestBed.flushEffects();
    expect(resource.error()).toBeInstanceOf(Error);
    expect((resource.error() as Error).message).toBe('consumer validation failed');
    ctrl.verify();
  });

  it('re-evaluates reactive params and headers and cancels obsolete requests', () => {
    const { http, ctrl } = setup();
    const page = signal(1);
    TestBed.runInInjectionContext(() => http.getResource('/items', {
      params: computed(() => ({ page: page() })),
      headers: () => ({ 'X-N': 'v' }),
    }));
    TestBed.flushEffects();
    const first = ctrl.expectOne(r => r.method === 'GET' && r.url === '/items');
    expect(first.request.params.get('page')).toBe('1');
    expect(first.request.headers.get('X-N')).toBe('v');
    page.set(2);
    TestBed.flushEffects();
    expect(first.cancelled).toBe(true);
    const second = ctrl.expectOne(r => r.method === 'GET' && r.url === '/items');
    expect(second.request.params.get('page')).toBe('2');
    second.flush([]);
    ctrl.verify({ ignoreCancelled: true });
  });

  it('cancels an old URL request when endpoint signal changes', async () => {
    const { http, ctrl } = setup();
    const endpoint = signal<string | undefined>('/a');
    const resource = TestBed.runInInjectionContext(() => http.getResource(endpoint));
    TestBed.flushEffects();
    const obsolete = ctrl.expectOne('/a');
    endpoint.set('/b'); TestBed.flushEffects();
    expect(obsolete.cancelled).toBe(true);
    ctrl.expectOne('/b').flush({ value: 'current' });
    await new Promise(resolve => setTimeout(resolve, 0));
    TestBed.flushEffects();
    expect(resource.value()).toEqual({ value: 'current' });
    ctrl.verify({ ignoreCancelled: true });
  });

  it('passes chaining context through for dependent requests', async () => {
    const { http, ctrl } = setup();
    const id = signal(1);
    const parent = TestBed.runInInjectionContext(() => http.getResource<{ id: number }>(() => `/parent/${id()}`));
    const child = TestBed.runInInjectionContext(() => http.getResource<string>(ctx => {
      const value = ctx.chain(parent);
      return value ? `/child/${value.id}` : undefined;
    }));
    TestBed.flushEffects();
    ctrl.expectNone(req => req.url.startsWith('/child/'));
    ctrl.expectOne('/parent/1').flush({ id: 10 });
    await new Promise(resolve => setTimeout(resolve, 0)); TestBed.flushEffects();
    const pending = ctrl.expectOne('/child/10');
    id.set(2); TestBed.flushEffects();
    ctrl.expectOne('/parent/2').flush({ id: 20 });
    await new Promise(resolve => setTimeout(resolve, 0)); TestBed.flushEffects();
    expect(pending.cancelled).toBe(true);
    ctrl.expectOne('/child/20').flush('current');
    await new Promise(resolve => setTimeout(resolve, 0)); TestBed.flushEffects();
    expect(child.value()).toBe('current');
    ctrl.verify({ ignoreCancelled: true });
  });

  it('preserves injector, defaultValue, equality, debugName and transport options', async () => {
    const { http, ctrl } = setup();
    const resource = http.getResource<{ id: number }>('/options', {
      injector: TestBed.inject(Injector), defaultValue: { id: 0 },
      debugName: 'options', equal: (a, b) => a?.id === b?.id,
      timeout: 456, transferCache: false,
    });
    expect(resource.value()).toEqual({ id: 0 });
    TestBed.flushEffects();
    const request = ctrl.expectOne('/options');
    expect(request.request.timeout).toBe(456);
    expect(request.request.transferCache).toBe(false);
    request.flush({ id: 1 });
    await new Promise(resolve => setTimeout(resolve, 0)); TestBed.flushEffects();
    const first = resource.value();
    resource.reload(); TestBed.flushEffects();
    ctrl.expectOne('/options').flush({ id: 1 });
    await new Promise(resolve => setTimeout(resolve, 0)); TestBed.flushEffects();
    expect(resource.value()).toBe(first);
    ctrl.verify();
  });

  it('keeps progress surface native without claiming XHR upload support', () => {
    const { http, ctrl } = setup();
    const resource = TestBed.runInInjectionContext(() => http.getResource('/progress', { reportProgress: true }));
    TestBed.flushEffects();
    expect(typeof resource.progress).toBe('function');
    ctrl.expectOne('/progress');
    ctrl.verify();
  });

  it('cancels pending request when its component is destroyed', () => {
    const { ctrl } = setup();
    const fixture = TestBed.createComponent(ResourceConsumer);
    fixture.detectChanges(); TestBed.flushEffects();
    const req = ctrl.expectOne('https://api.test/destroyed');
    fixture.destroy();
    expect(req.cancelled).toBe(true);
    ctrl.verify({ ignoreCancelled: true });
  });

  it('keeps disabled endpoint undefined and activates later', () => {
    const { http, ctrl } = setup();
    const endpoint = signal<string | undefined>(undefined);
    TestBed.runInInjectionContext(() => http.getResource(endpoint));
    TestBed.flushEffects();
    expect(ctrl.match(() => true)).toHaveLength(0);
    endpoint.set('/ready'); TestBed.flushEffects();
    ctrl.expectOne('/ready').flush({ ok: true });
    ctrl.verify();
  });
});
