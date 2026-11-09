import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RiviniaModalScrollLock } from '../ui/src/lib/components/modal-scroll-lock/modal-scroll-lock';

function fakeDocument() {
  const calls: string[] = [];
  let gutter = '';
  let gutterPriority = '';
  const bodyStyle = {
    overflow: '',
    removeProperty: vi.fn((name: string) => {
      calls.push(`body-remove:${name}`);
    }),
  };
  const rootStyle = {
    getPropertyValue: vi.fn((name: string) => (name === 'scrollbar-gutter' ? gutter : '')),
    getPropertyPriority: vi.fn((name: string) =>
      name === 'scrollbar-gutter' ? gutterPriority : '',
    ),
    setProperty: vi.fn((name: string, value: string, priority = '') => {
      if (name === 'scrollbar-gutter') {
        gutter = value;
        gutterPriority = priority;
      }
      calls.push(`root-set:${name}`);
    }),
    removeProperty: vi.fn((name: string) => {
      if (name === 'scrollbar-gutter') {
        gutter = '';
        gutterPriority = '';
      }
      calls.push(`root-remove:${name}`);
    }),
  };
  return {
    doc: { body: { style: bodyStyle }, documentElement: { style: rootStyle } },
    calls,
    bodyStyle,
    rootStyle,
  };
}

function setup(doc: unknown): RiviniaModalScrollLock {
  TestBed.configureTestingModule({
    providers: [{ provide: DOCUMENT, useValue: doc }],
  });
  return TestBed.inject(RiviniaModalScrollLock);
}

beforeEach(() => {
  TestBed.resetTestingModule();
});

describe('RiviniaModalScrollLock', () => {
  it('locks on first acquire and restores the previous value on last release', () => {
    const { doc, bodyStyle } = fakeDocument();
    const lock = setup(doc);
    bodyStyle.overflow = 'auto';
    lock.acquire();
    expect(lock.active).toBe(1);
    expect(bodyStyle.overflow).toBe('hidden');
    lock.release();
    expect(lock.active).toBe(0);
    expect(bodyStyle.overflow).toBe('auto');
  });

  it('reference-counts nested overlays (one release does not unlock)', () => {
    const { doc, bodyStyle } = fakeDocument();
    const lock = setup(doc);
    lock.acquire();
    lock.acquire();
    expect(lock.active).toBe(2);
    lock.release();
    expect(lock.active).toBe(1);
    expect(bodyStyle.overflow).toBe('hidden');
    lock.release();
    expect(lock.active).toBe(0);
  });

  it('restores the consumer scrollbar gutter and its priority after the final release', () => {
    const { doc, rootStyle } = fakeDocument();
    const lock = setup(doc);
    rootStyle.setProperty('scrollbar-gutter', 'stable both-edges', 'important');

    lock.acquire();
    lock.acquire();
    lock.release();
    expect(rootStyle.getPropertyValue('scrollbar-gutter')).toBe('stable');
    lock.release();

    expect(rootStyle.getPropertyValue('scrollbar-gutter')).toBe('stable both-edges');
    expect(rootStyle.getPropertyPriority('scrollbar-gutter')).toBe('important');
  });

  it('release without acquire is a safe no-op', () => {
    const { doc } = fakeDocument();
    const lock = setup(doc);
    expect(() => lock.release()).not.toThrow();
    expect(lock.active).toBe(0);
  });

  it('is inert without a document (SSR)', () => {
    const lock = setup(null);
    expect(() => {
      lock.acquire();
      lock.release();
    }).not.toThrow();
    expect(lock.active).toBe(0);
  });
});
