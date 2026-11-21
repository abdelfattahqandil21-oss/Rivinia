import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { RiviniaTablePagerComponent } from '@rivinia/table/ui';

describe('table pager', () => {
  function mount(count: number) {
    const fixture = TestBed.createComponent(RiviniaTablePagerComponent);
    fixture.componentRef.setInput('pageCount', count);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    return { fixture, pager: fixture.componentInstance, root,
      button: (label: string) => root.querySelector<HTMLButtonElement>('button[aria-label="' + label + '"]')!,
    };
  }

  it('navigates to the last and first pages and emits a size change', () => {
    const { fixture, pager, root, button } = mount(3);
    button('Last page').click();
    expect(pager.page()).toBe(2);
    fixture.detectChanges();
    expect(button('Next page').disabled).toBe(true);
    button('First page').click();
    expect(pager.page()).toBe(0);
    const size = root.querySelector('select')!;
    size.value = '25';
    size.dispatchEvent(new Event('change'));
    expect(pager.pageSize()).toBe(25);
  });

  it('requires an explicit hasNext signal when the total is unknown', () => {
    const { fixture, pager, button } = mount(-1);
    expect(button('Last page').disabled).toBe(true);
    expect(button('Next page').disabled).toBe(true);
    fixture.componentRef.setInput('hasNext', true);
    fixture.detectChanges();
    button('Next page').click();
    expect(pager.page()).toBe(1);
  });
});
