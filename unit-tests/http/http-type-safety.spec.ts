import type { HttpEvent, HttpResourceRef, HttpResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import type { RiviniaHttp } from '../../projects/http/src/lib/services/rivinia-http';
import type { RiviniaRequestOptions } from '../../projects/http/src/lib/models/http-options';
import { provideRiviniaHttp } from '../../projects/http/src/lib/providers/provide-http';

interface User { id: number }
declare const http: RiviniaHttp;

// Compile-time assertions: functions deliberately never invoked in the test.
function assertRawContracts(): void {
  http.get<User[]>('/users');
  http.post<User>('/users', {});
  http.put<User>('/users/1', {});
  http.patch<User>('/users/1', {});
  http.delete<void>('/users/1', { body: { reason: 'x' } });
  http.getBlob('/file');
  http.getText('/note');
  http.getResponse<User[]>('/users');
  http.postResponse<User>('/users', {});
  http.query<User[]>('/search', { q: 'x' });
  http.getResource<User[]>('/users');
  http.get('/users', { params: { tag: ['a', 'b'] as const, omit: null } });
}

function assertOverloads(): void {
  const body: import('rxjs').Observable<User[]> = http.request<User[]>('GET', '/users');
  const response: import('rxjs').Observable<HttpResponse<User[]>> = http.request<User[]>('GET', '/users', { observe: 'response' });
  const events: import('rxjs').Observable<HttpEvent<User[]>> = http.request<User[]>('PATCH', '/users', { observe: 'events', body: {} });
  const blob: import('rxjs').Observable<Blob> = http.request('GET', '/file', { responseType: 'blob' });
  const text: import('rxjs').Observable<string> = http.request('GET', '/text', { responseType: 'text' });
  const bytes: import('rxjs').Observable<ArrayBuffer> = http.request('GET', '/binary', { responseType: 'arraybuffer' });
  const binaryResponse: import('rxjs').Observable<HttpResponse<Blob>> = http.request('GET', '/file', { responseType: 'blob', observe: 'response' });
  // @ts-expect-error - body is not an HttpResponse
  const wrong: import('rxjs').Observable<HttpResponse<User[]>> = http.request<User[]>('GET', '/users');
  void body; void response; void events; void blob; void text; void bytes; void binaryResponse; void wrong;
}

function assertResourceTypes(): void {
  const defined: HttpResourceRef<User[]> = http.getResource<User[]>('/users', { defaultValue: [] });
  const nullable: HttpResourceRef<User | null> = http.getResource<User | null>('/users/1', { defaultValue: null });
  // @ts-expect-error - undefined is possible without a defaultValue
  const absent: HttpResourceRef<User[]> = http.getResource<User[]>('/users');
  void defined; void nullable; void absent;
}

function assertRemovedBusinessContracts(): void {
  // @ts-expect-error - no implicit or opt-in unwrap in transport V2
  http.get('/users', { unwrap: true, unwrapKey: 'data' });
  // @ts-expect-error - a backend-specific error policy cannot be set on requests
  http.get('/users', { envelope: {} });
  // @ts-expect-error - resources do not interpret backend envelopes
  http.getResource('/users', { unwrap: true, unwrapKey: 'data' });
  // @ts-expect-error - transport provider is deliberately configuration-free
  provideRiviniaHttp({ envelope: {} });
  // @ts-expect-error - backend features belong to Angular provideHttpClient
  provideRiviniaHttp({ httpFeatures: [] });
  // @ts-expect-error - option type has no business-dependent fields
  const opts: RiviniaRequestOptions = { unwrap: true };
  void opts;
  // @ts-expect-error - discriminated union rejects unsupported MIME response types
  http.request('GET', '/body', { responseType: 'xml' });
}

describe('V2 TypeScript contracts', () => {
  it('keeps compile-time assertions in the build surface', () => {
    for (const fn of [assertRawContracts, assertOverloads, assertResourceTypes, assertRemovedBusinessContracts])
      expect(typeof fn).toBe('function');
  });
});
