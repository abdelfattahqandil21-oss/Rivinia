import { SelectController, type SelectOption } from './select-controller';

interface City {
  readonly id: string;
  readonly name: string;
}

const city = (id: string, name = id): City => ({ id, name });
const option = (value: City, disabled = false): SelectOption<City> => ({
  key: value.id,
  value,
  label: value.name,
  disabled,
});

describe('SelectController', () => {
  it('uses stable option identity and commits single selection once', () => {
    const select = new SelectController<City>({ keyOf: (value) => value.id });
    select.setOptions([option(city('a', 'Alpha')), option(city('b', 'Beta'))]);
    select.open();

    expect(select.activeOption()?.key).toBe('a');
    expect(select.select('b')).toBe(true);
    expect(select.value()).toEqual(city('b', 'Beta'));
    expect(select.isOpen()).toBe(false);
    expect(select.query()).toBe('');
  });

  it('toggles multiple selection while preserving query, open state, and active key', () => {
    const select = new SelectController<City>({ keyOf: (value) => value.id, mode: 'multiple' });
    select.setOptions([option(city('a', 'Alpha')), option(city('b', 'Beta'))]);
    select.setQuery('a');
    select.setActive('a');

    expect(select.select('a')).toBe(true);
    expect(select.select('a')).toBe(true);
    expect(select.value()).toEqual([]);
    expect(select.query()).toBe('a');
    expect(select.isOpen()).toBe(true);
    expect(select.activeKey()).toBe('a');
  });

  it('preserves selected identity through filtering and refreshes the value for a matching key', () => {
    const select = new SelectController<City>({ keyOf: (value) => value.id, mode: 'multiple' });
    select.setOptions([option(city('a', 'Alpha')), option(city('b', 'Beta'))]);
    select.select('a');
    select.setQuery('bet');
    expect(select.selectedKeys()).toEqual(['a']);
    expect(select.visibleOptions().map((item) => item.key)).toEqual(['b']);

    const refreshed = city('a', 'Alpha refreshed');
    select.setOptions([option(refreshed), option(city('b', 'Beta'))]);
    expect(select.value()).toEqual([refreshed]);
  });

  it('retains selected values while their options are absent during an async page replacement', () => {
    const select = new SelectController<City>({ keyOf: (value) => value.id, mode: 'multiple' });
    const selected = city('kept', 'Kept value');
    select.writeValue([selected]);
    select.setOptions([option(city('other'))]);
    expect(select.selectedKeys()).toEqual(['kept']);
    expect(select.value()).toEqual([selected]);
  });

  it('rejects duplicate option keys and duplicate values', () => {
    const select = new SelectController<City>({ keyOf: (value) => value.id, mode: 'multiple' });
    expect(() => select.setOptions([option(city('a')), option(city('a'))])).toThrow(/duplicated/);
    expect(() => select.writeValue([city('a'), city('a')])).toThrow(/duplicate/);
  });

  it('includes disabled options in active navigation but blocks their selection', () => {
    const select = new SelectController<City>({ keyOf: (value) => value.id });
    select.setOptions([option(city('disabled'), true), option(city('enabled'))]);
    select.open();
    expect(select.activeOption()?.key).toBe('disabled');
    expect(select.select('disabled')).toBe(false);
    expect(select.moveActive('next')?.key).toBe('enabled');
    expect(select.value()).toBeNull();
  });

  it('wraps active navigation and supports first/last boundaries', () => {
    const select = new SelectController<City>({ keyOf: (value) => value.id });
    select.setOptions([option(city('a')), option(city('b'))]);
    select.open('last');
    expect(select.activeKey()).toBe('b');
    expect(select.moveActive('next')?.key).toBe('a');
    expect(select.moveActive('previous')?.key).toBe('b');
    expect(select.moveActive('first')?.key).toBe('a');
  });

  it('moves the active option to the nearest surviving row after dynamic removal', () => {
    const select = new SelectController<City>({ keyOf: (value) => value.id });
    select.setOptions([option(city('a')), option(city('b')), option(city('c'))]);
    select.open();
    select.moveActive('next');
    select.unregisterOption('b');
    expect(select.activeKey()).toBe('c');
  });

  it('filters with the configured locale and updates active option when the query changes', () => {
    const select = new SelectController<City>({ keyOf: (value) => value.id, locale: 'en' });
    select.setOptions([option(city('a', 'Álpha')), option(city('b', 'Beta'))]);
    select.open();
    select.setQuery('bet');
    expect(select.visibleOptions().map((item) => item.key)).toEqual(['b']);
    expect(select.activeKey()).toBe('b');
    expect(select.hasNoResults()).toBe(false);
    select.setQuery('missing');
    expect(select.visibleOptions()).toEqual([]);
    expect(select.activeKey()).toBeUndefined();
    expect(select.hasNoResults()).toBe(true);
  });

  it('clears selection without changing available options', () => {
    const select = new SelectController<City>({ keyOf: (value) => value.id, mode: 'multiple' });
    select.setOptions([option(city('a'))]);
    select.select('a');
    select.clear();
    expect(select.value()).toEqual([]);
    expect(select.options().map((item) => item.key)).toEqual(['a']);
  });

  it('rejects multiple values in single mode', () => {
    const select = new SelectController<City>({ keyOf: (value) => value.id });
    expect(() => select.writeValue([city('a'), city('b')])).toThrow(/single Select/);
  });

  it('ignores stale async success and error completions', () => {
    const select = new SelectController<City>({ keyOf: (value) => value.id });
    const oldRequest = select.beginLoad('initial');
    const latestRequest = select.beginLoad('initial');
    expect(select.resolveLoad(oldRequest, [option(city('old'))])).toBe(false);
    expect(select.rejectLoad(oldRequest, new Error('stale'))).toBe(false);
    expect(select.resolveLoad(latestRequest, [option(city('new'))])).toBe(true);
    expect(select.options().map((item) => item.key)).toEqual(['new']);
    expect(select.load().status).toBe('ready');
  });

  it('separates initial loading, empty, error, and no-results states', () => {
    const select = new SelectController<City>({ keyOf: (value) => value.id });
    const initial = select.beginLoad();
    expect(select.load().status).toBe('loading');
    expect(select.options()).toEqual([]);
    select.resolveLoad(initial, []);
    expect(select.load().status).toBe('empty');
    const retry = select.beginLoad();
    select.rejectLoad(retry, new Error('offline'));
    expect(select.load().status).toBe('error');
    expect(select.load().error).toBeInstanceOf(Error);
    select.setOptions([option(city('a', 'Alpha'))]);
    select.setQuery('missing');
    expect(select.load().status).toBe('ready');
    expect(select.hasNoResults()).toBe(true);
  });

  it('appends load-more pages and ignores an older page completion', () => {
    const select = new SelectController<City>({ keyOf: (value) => value.id });
    select.setOptions([option(city('a'))]);
    const stale = select.beginLoad('more');
    const current = select.beginLoad('more');
    expect(select.load().loadingMore).toBe(true);
    expect(select.resolveLoad(stale, [option(city('old'))], true)).toBe(false);
    expect(select.resolveLoad(current, [option(city('b'))], true)).toBe(true);
    expect(select.options().map((item) => item.key)).toEqual(['a', 'b']);
    expect(select.load().loadingMore).toBe(false);
    expect(select.load().status).toBe('ready');
  });

  it('blocks changes while the control is disabled', () => {
    const select = new SelectController<City>({ keyOf: (value) => value.id });
    select.setOptions([option(city('a'))]);
    select.setDisabled(true);
    select.open();
    expect(select.isOpen()).toBe(false);
    expect(select.select('a')).toBe(false);
    expect(select.value()).toBeNull();
  });
});
