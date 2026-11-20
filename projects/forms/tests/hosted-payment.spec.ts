import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expect, it } from 'vitest';
import { RiviniaHostedPaymentComponent, type HostedPaymentState } from '../src/public-api';

@Component({
  imports: [RiviniaHostedPaymentComponent],
  template: `<rv-hosted-payment [state]="state()" (retry)="retries = retries + 1">
    <div id="mount"></div>
  </rv-hosted-payment>`,
})
class Host {
  readonly state = signal<HostedPaymentState>('loading');
  retries = 0;
}

it('keeps the provider mount stable and delegates retry to the application', () => {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root: HTMLElement = fixture.nativeElement;
  const mount = root.querySelector('#mount')!;
  expect(mount.closest('[hidden]')).not.toBeNull();

  fixture.componentInstance.state.set('ready');
  fixture.detectChanges();
  expect(root.querySelector('#mount')).toBe(mount);
  expect(mount.closest('[hidden]')).toBeNull();

  fixture.componentInstance.state.set('error');
  fixture.detectChanges();
  expect(root.querySelector('#mount')).toBe(mount);
  expect(root.querySelector('[role="alert"]')?.textContent).toContain('could not be loaded');
  root.querySelector('button')!.click();
  expect(fixture.componentInstance.retries).toBe(1);
});
