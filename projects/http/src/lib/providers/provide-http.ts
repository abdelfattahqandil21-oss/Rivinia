import { EnvironmentProviders, inject, makeEnvironmentProviders } from '@angular/core';
import { RiviniaHttp } from '../services/rivinia-http';

/**
 * Explicitly registers the response-agnostic facade in the application.
 *
 * The application owns `provideHttpClient(withInterceptors(...))`, XSRF,
 * fetch/XHR, auth, error policies and backend configuration. This provider
 * neither installs an HTTP backend nor registers interceptors.
 */
export function provideRiviniaHttp(): EnvironmentProviders {
  return makeEnvironmentProviders([RiviniaHttp]);
}

/** Shorthand for `inject(RiviniaHttp)` inside an Angular injection context. */
export function injectRiviniaHttp(): RiviniaHttp {
  return inject(RiviniaHttp);
}
