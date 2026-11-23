import type { HttpContext, HttpHeaders, HttpParams, HttpClientCommonOptions } from '@angular/common/http';
import type { Signal } from '@angular/core';

/** Evaluated in Angular's `httpResource` request callback, preserving signal tracking. */
export type ReactiveInput<T> = T | Signal<T> | (() => T);

/** Object shorthand: readonly primitive arrays use repeated query parameter keys. */
export type QueryParamsInput =
  | HttpParams
  | Record<string, string | number | boolean | readonly (string | number | boolean)[] | undefined | null>;

/** Native transport controls, with no Rivinia-owned retry, cache or response interpretation. */
export interface RiviniaTransportOptions extends Pick<HttpClientCommonOptions,
  'withCredentials' | 'timeout' | 'transferCache' | 'keepalive' | 'cache' |
  'credentials' | 'priority' | 'mode' | 'redirect' | 'referrer' | 'referrerPolicy' | 'integrity'> {}

export interface RiviniaRequestBase extends RiviniaTransportOptions {
  params?: QueryParamsInput;
  headers?: HttpHeaders | Record<string, string | string[]>;
  /** Goes straight to Angular interceptors; Rivinia never interprets it. */
  context?: HttpContext;
}

/** All shorthand JSON methods return the complete, unmodified response body. */
export type RiviniaRequestOptions = RiviniaRequestBase;
/** `delete` may carry a body without reinterpreting its response. */
export interface RiviniaDeleteRequestOptions extends RiviniaRequestBase {
  body?: unknown;
}
/** Raw text/blob and the two legacy full-response shortcuts accept the same native controls. */
export type RiviniaRawOptions = RiviniaRequestBase;

/** Generic `request()` forwards Angular's body, event and response observation modes. */
export interface RiviniaHttpRequestBase extends RiviniaRequestBase {
  body?: unknown;
  reportProgress?: boolean;
}
export type RiviniaHttpJsonBodyOptions = RiviniaHttpRequestBase & { observe?: 'body'; responseType?: 'json' };
export type RiviniaHttpJsonResponseOptions = RiviniaHttpRequestBase & { observe: 'response'; responseType?: 'json' };
export type RiviniaHttpJsonEventsOptions = RiviniaHttpRequestBase & { observe: 'events'; responseType?: 'json' };

export type RiviniaHttpBinaryKind = 'arraybuffer' | 'blob' | 'text';
export type RiviniaHttpNonJsonOptions<K extends RiviniaHttpBinaryKind, O extends 'body' | 'response' | 'events'> =
  RiviniaHttpRequestBase & { responseType: K; observe: O };
export type RiviniaHttpAnyRequestOptions = RiviniaHttpRequestBase & {
  responseType?: 'json' | RiviniaHttpBinaryKind;
  observe?: 'body' | 'response' | 'events';
};
