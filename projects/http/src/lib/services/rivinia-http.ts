import {
  HttpClient,
  HttpParams,
  httpResource,
  type HttpContext,
  type HttpEvent,
  type HttpHeaders,
  type HttpResourceRef,
  type HttpResourceOptions,
  type HttpResponse,
} from '@angular/common/http';
import { Service, inject, isSignal, type Signal, type ResourceParamsContext } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  QueryParamsInput,
  ReactiveInput,
  RiviniaDeleteRequestOptions,
  RiviniaRawOptions,
  RiviniaRequestBase,
  RiviniaRequestOptions,
  RiviniaTransportOptions,
  RiviniaHttpAnyRequestOptions,
  RiviniaHttpRequestBase,
  RiviniaHttpJsonBodyOptions,
  RiviniaHttpJsonEventsOptions,
  RiviniaHttpJsonResponseOptions,
  RiviniaHttpNonJsonOptions,
} from '../models/http-options';

export type RiviniaResourceEndpoint = string | Signal<string | undefined> |
  ((context: ResourceParamsContext) => string | undefined);

export interface RiviniaResourceOptions<T> extends RiviniaTransportOptions,
  Pick<HttpResourceOptions<T, unknown>, 'injector' | 'equal' | 'debugName'> {
  params?: ReactiveInput<QueryParamsInput>;
  headers?: ReactiveInput<HttpHeaders | Record<string, string | string[]>>;
  context?: ReactiveInput<HttpContext>;
  defaultValue?: T;
  /** Optional *consumer-owned* parse/validation of the raw JSON body. */
  parse?: (value: unknown) => T;
  reportProgress?: boolean;
}

/**
 * Minimal Angular-native, response-agnostic transport facade.
 *
 * Does NOT unwrap, validate business envelopes, retry, translate errors,
 * cache server state, or rewrite URLs. Angular handles HTTP errors and
 * interceptors. Domain services own response interpretation.
 */
@Service()
export class RiviniaHttp {
  private readonly http = inject(HttpClient);

  get<T>(endpoint: string, options?: RiviniaRequestOptions): Observable<T> {
    return this.http.get<T>(endpoint, this.httpOptions(options));
  }

  post<T>(endpoint: string, body?: unknown, options?: RiviniaRequestOptions): Observable<T> {
    return this.http.post<T>(endpoint, body, this.httpOptions(options));
  }

  put<T>(endpoint: string, body?: unknown, options?: RiviniaRequestOptions): Observable<T> {
    return this.http.put<T>(endpoint, body, this.httpOptions(options));
  }

  patch<T>(endpoint: string, body?: unknown, options?: RiviniaRequestOptions): Observable<T> {
    return this.http.patch<T>(endpoint, body, this.httpOptions(options));
  }

  delete<T>(endpoint: string, options?: RiviniaDeleteRequestOptions): Observable<T> {
    return this.http.delete<T>(endpoint, { ...this.httpOptions(options), body: options?.body });
  }

  getBlob(endpoint: string, options?: RiviniaRawOptions): Observable<Blob> {
    return this.http.get(endpoint, { ...this.httpOptions(options), responseType: 'blob' });
  }

  getText(endpoint: string, options?: RiviniaRawOptions): Observable<string> {
    return this.http.get(endpoint, { ...this.httpOptions(options), responseType: 'text' });
  }

  /** Kept as a convenience shortcut; `request(..., { observe: 'response' })` is universal. */
  getResponse<T>(endpoint: string, options?: RiviniaRawOptions): Observable<HttpResponse<T>> {
    return this.http.get<T>(endpoint, { ...this.httpOptions(options), observe: 'response' });
  }

  /** Kept as a convenience shortcut; no envelope checks or transformations. */
  postResponse<T>(endpoint: string, body?: unknown, options?: RiviniaRawOptions): Observable<HttpResponse<T>> {
    return this.http.post<T>(endpoint, body, { ...this.httpOptions(options), observe: 'response' });
  }

  /**
   * General escape hatch for all HTTP methods and Angular response modes.
   * Native `observe` / `responseType` discriminants preserve exact return types.
   */
  request<T>(method: string, endpoint: string, options: RiviniaHttpJsonResponseOptions): Observable<HttpResponse<T>>;
  request<T>(method: string, endpoint: string, options: RiviniaHttpJsonEventsOptions): Observable<HttpEvent<T>>;
  request<T>(method: string, endpoint: string, options?: RiviniaHttpJsonBodyOptions): Observable<T>;
  request(method: string, endpoint: string, options: RiviniaHttpNonJsonOptions<'blob', 'response'>): Observable<HttpResponse<Blob>>;
  request(method: string, endpoint: string, options: RiviniaHttpNonJsonOptions<'blob', 'events'>): Observable<HttpEvent<Blob>>;
  request(method: string, endpoint: string, options: RiviniaHttpNonJsonOptions<'blob', 'body'> | (RiviniaHttpRequestBase & { responseType: 'blob'; observe?: 'body' })): Observable<Blob>;
  request(method: string, endpoint: string, options: RiviniaHttpNonJsonOptions<'text', 'response'>): Observable<HttpResponse<string>>;
  request(method: string, endpoint: string, options: RiviniaHttpNonJsonOptions<'text', 'events'>): Observable<HttpEvent<string>>;
  request(method: string, endpoint: string, options: RiviniaHttpNonJsonOptions<'text', 'body'> | (RiviniaHttpRequestBase & { responseType: 'text'; observe?: 'body' })): Observable<string>;
  request(method: string, endpoint: string, options: RiviniaHttpNonJsonOptions<'arraybuffer', 'response'>): Observable<HttpResponse<ArrayBuffer>>;
  request(method: string, endpoint: string, options: RiviniaHttpNonJsonOptions<'arraybuffer', 'events'>): Observable<HttpEvent<ArrayBuffer>>;
  request(method: string, endpoint: string, options: RiviniaHttpNonJsonOptions<'arraybuffer', 'body'> | (RiviniaHttpRequestBase & { responseType: 'arraybuffer'; observe?: 'body' })): Observable<ArrayBuffer>;
  request(method: string, endpoint: string, options?: RiviniaHttpAnyRequestOptions): Observable<unknown> {
    // Angular owns dispatch and serialization. The public overloads above
    // preserve return types; this is only the runtime union dispatch.
    return this.http.request(method, endpoint, {
      ...this.httpOptions(options),
      body: options?.body,
      reportProgress: options?.reportProgress,
      observe: options?.observe ?? 'body',
      responseType: options?.responseType ?? 'json',
    });
  }

  /** Supports QUERY on Angular 22.2 via native request('QUERY'); no minimum-version bump. */
  query<T>(endpoint: string, body?: unknown, options?: RiviniaRequestOptions): Observable<T> {
    return this.request<T>('QUERY', endpoint, { ...options, body });
  }

  /** Reactive native JSON resource: no implicit response transformation. */
  getResource<T>(
    endpoint: RiviniaResourceEndpoint,
    options: RiviniaResourceOptions<T> & { defaultValue: T },
  ): HttpResourceRef<T>;
  getResource<T>(
    endpoint: RiviniaResourceEndpoint,
    options?: RiviniaResourceOptions<T>,
  ): HttpResourceRef<T | undefined>;
  getResource<T>(
    endpoint: RiviniaResourceEndpoint,
    options?: RiviniaResourceOptions<T>,
  ): HttpResourceRef<T | undefined> {
    const { defaultValue, parse, reportProgress, injector, equal, debugName, ...requestOptions } = options ?? {};
    const request = (ctx: ResourceParamsContext) => {
      const url = typeof endpoint === 'string' ? endpoint : endpoint(ctx);
      if (url === undefined) return undefined;
      return {
        url,
        ...this.httpOptions({
          ...requestOptions,
          params: resolveInput(requestOptions.params),
          headers: resolveInput(requestOptions.headers),
          context: resolveInput(requestOptions.context),
        }),
        ...(reportProgress !== undefined ? { reportProgress } : {}),
      };
    };
    const base = { injector, equal, debugName };
    const parsing = parse ? { parse } : {};
    return defaultValue === undefined
      ? httpResource<T>(request, { ...base, ...parsing })
      : httpResource<T>(request, { ...base, ...parsing, defaultValue });
  }

  private httpOptions(options?: RiviniaRequestBase) {
    return {
      params: this.toParams(options?.params),
      headers: options?.headers,
      context: options?.context,
      withCredentials: options?.withCredentials,
      timeout: options?.timeout,
      transferCache: options?.transferCache,
      keepalive: options?.keepalive,
      cache: options?.cache,
      credentials: options?.credentials,
      priority: options?.priority,
      mode: options?.mode,
      redirect: options?.redirect,
      referrer: options?.referrer,
      referrerPolicy: options?.referrerPolicy,
      integrity: options?.integrity,
    };
  }

  private toParams(input?: QueryParamsInput): HttpParams | undefined {
    if (!input) return undefined;
    if (input instanceof HttpParams) return input;
    let params = new HttpParams();
    for (const [key, value] of Object.entries(input)) {
      if (value === null || value === undefined) continue;
      if (Array.isArray(value)) {
        for (const item of value) params = params.append(key, String(item));
      } else {
        params = params.set(key, String(value));
      }
    }
    return params;
  }
}

function resolveInput<T>(value: ReactiveInput<T> | undefined): T | undefined {
  if (value === undefined) return undefined;
  if (isSignal(value)) return (value as Signal<T>)();
  if (typeof value === 'function') return (value as () => T)();
  return value as T;
}
