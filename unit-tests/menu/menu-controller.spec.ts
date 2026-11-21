import { MenuController } from '../../projects/menu/src/lib/menu-controller';

describe('MenuController', () => {
  it('opens on the first or last registered item and closes idempotently', () => {
    const menu = createMenu();
    menu.open();
    expect(menu.isOpen()).toBe(true);
    expect(menu.activeItem()?.id).toBe('edit');
    menu.open('last');
    expect(menu.activeItem()?.id).toBe('radio-b');
    menu.close();
    menu.close();
    expect(menu.isOpen()).toBe(false);
    expect(menu.activeItemId()).toBeUndefined();
  });

  it('wraps movement and includes disabled items', () => {
    const menu = createMenu();
    menu.open();
    expect(menu.move('previous')?.id).toBe('radio-b');
    expect(menu.move('next')?.id).toBe('edit');
    expect(menu.move('next')?.id).toBe('disabled');
    expect(menu.move('last')?.id).toBe('radio-b');
  });

  it('moves to Home and End equivalents and safely handles an empty menu', () => {
    const menu = new MenuController();
    menu.open();
    expect(menu.move('next')).toBeNull();
    expect(menu.activeItemId()).toBeUndefined();
    menu.registerItem({ id: 'one', textValue: 'One' });
    menu.registerItem({ id: 'two', textValue: 'Two' });
    expect(menu.move('first')?.id).toBe('one');
    expect(menu.move('last')?.id).toBe('two');
  });

  it('registers, updates, unregisters, and reorders dynamic items', () => {
    const menu = new MenuController();
    const removeB = menu.registerItem({ id: 'b', textValue: 'Beta' });
    menu.registerItem({ id: 'a', textValue: 'Alpha' });
    menu.registerItem({ id: 'c', textValue: 'Charlie' });
    menu.setItemOrder(['c', 'a', 'b']);
    expect(menu.items().map((item) => item.id)).toEqual(['c', 'a', 'b']);
    const orderedItems = menu.items();
    menu.setItemOrder(['c', 'a', 'b']);
    expect(menu.items()).toBe(orderedItems);
    menu.setActiveItem('a');
    menu.updateItem('a', { disabled: true });
    expect(menu.activeItem()?.disabled).toBe(true);
    removeB();
    removeB();
    expect(menu.items().map((item) => item.id)).toEqual(['c', 'a']);
    expect(menu.activeItemId()).toBe('a');
  });

  it('reconciles active item removal to the nearest surviving rendered position', () => {
    const menu = createMenu();
    menu.open();
    menu.move('next');
    expect(menu.activeItemId()).toBe('disabled');
    menu.unregisterItem('disabled');
    expect(menu.activeItemId()).toBe('checkbox');
  });

  it('rejects duplicate registrations and invalid order instructions', () => {
    const menu = new MenuController();
    menu.registerItem({ id: 'one', textValue: 'One' });
    expect(() => menu.registerItem({ id: 'one', textValue: 'Again' })).toThrow(
      /already registered/,
    );
    expect(() => menu.setItemOrder(['missing'])).toThrow(/unregistered/);
    expect(() => menu.setItemOrder(['one', 'one'])).toThrow(/more than once/);
  });

  it('cycles Unicode-aware typeahead across disabled items and resets when closed', () => {
    const menu = new MenuController();
    menu.registerItem({ id: 'cafe', textValue: 'Café' });
    menu.registerItem({ id: 'cat', textValue: 'Cat' });
    menu.registerItem({ id: 'disabled-c', textValue: 'Car', disabled: true });
    menu.open();
    expect(menu.typeahead('c', { now: 0 })?.id).toBe('cat');
    expect(menu.typeahead('c', { now: 10 })?.id).toBe('disabled-c');
    expect(menu.typeahead('c', { now: 20 })?.id).toBe('cafe');
    expect(menu.typeahead('a', { now: 30 })?.id).toBe('cat');
    menu.close();
    menu.open();
    expect(menu.typeahead('c', { now: 40 })?.id).toBe('cat');
  });

  it('uses the configured locale for case-aware matching', () => {
    const menu = new MenuController();
    menu.registerItem({ id: 'turkish', textValue: 'İzmir' });
    menu.open();
    expect(menu.typeahead('i', { locale: 'tr', now: 0 })?.id).toBe('turkish');
  });

  it('does not optimistically mutate consumer-controlled checkbox and radio values', () => {
    const menu = createMenu();
    const checkbox = menu.activate('checkbox');
    expect(checkbox).toMatchObject({ type: 'checked-change', checked: true });
    expect(menu.items().find((item) => item.id === 'checkbox')?.checked).toBe(false);
    const radio = menu.activate('radio-b');
    expect(radio).toMatchObject({ type: 'checked-change', checked: true });
    expect(menu.items().filter((item) => item.kind === 'radio' && item.checked)).toHaveLength(1);
    menu.updateItem('radio-a', { checked: false });
    menu.updateItem('radio-b', { checked: true });
    expect(
      menu
        .items()
        .filter((item) => item.kind === 'radio' && item.checked)
        .map((item) => item.id),
    ).toEqual(['radio-b']);
  });

  it('blocks action and checked requests when disabled, including a live state change', () => {
    const menu = createMenu();
    expect(menu.activate('disabled')).toBeNull();
    menu.updateItem('checkbox', { disabled: true });
    expect(menu.activate('checkbox')).toBeNull();
    menu.updateItem('edit', { disabled: true });
    expect(menu.activate('edit')).toBeNull();
    expect(menu.isOpen()).toBe(false);
  });

  it('closes only action activations and leaves checked items open for consumer updates', () => {
    const menu = createMenu();
    menu.open();
    expect(menu.activate('checkbox')?.type).toBe('checked-change');
    expect(menu.isOpen()).toBe(true);
    expect(menu.activate('edit')?.type).toBe('action');
    expect(menu.isOpen()).toBe(false);
  });

  it('permits radio groups to be independently consumer-controlled', () => {
    const menu = new MenuController();
    menu.registerItem({
      id: 'theme-light',
      textValue: 'Light',
      kind: 'radio',
      radioGroup: 'theme',
      checked: true,
    });
    menu.registerItem({ id: 'theme-dark', textValue: 'Dark', kind: 'radio', radioGroup: 'theme' });
    menu.registerItem({
      id: 'sort-a',
      textValue: 'Ascending',
      kind: 'radio',
      radioGroup: 'sort',
      checked: true,
    });
    expect(menu.items().filter((item) => item.kind === 'radio' && item.checked)).toHaveLength(2);
    expect(menu.activate('theme-dark')).toMatchObject({ type: 'checked-change', checked: true });
  });
});

function createMenu(): MenuController {
  const menu = new MenuController();
  menu.registerItem({ id: 'edit', textValue: 'Edit' });
  menu.registerItem({ id: 'disabled', textValue: 'Disabled', disabled: true });
  menu.registerItem({ id: 'checkbox', textValue: 'Show hidden files', kind: 'checkbox' });
  menu.registerItem({
    id: 'radio-a',
    textValue: 'Ascending',
    kind: 'radio',
    radioGroup: 'sort',
    checked: true,
  });
  menu.registerItem({ id: 'radio-b', textValue: 'Descending', kind: 'radio', radioGroup: 'sort' });
  return menu;
}
