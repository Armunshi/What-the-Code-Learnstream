import { beforeEach, describe, expect, it } from 'vitest';
import { GUEST_CART_STORAGE_KEY, GUEST_CART_MAX_ITEMS, useGuestCartStore } from './guestCartStore.js';

const item = (id) => ({ id, title: `Course ${id}`, priceInPaise: 49900 });

describe('useGuestCartStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useGuestCartStore.setState({ items: [] });
  });

  it('adds an item and persists it to localStorage', () => {
    useGuestCartStore.getState().add(item('course-1'));

    expect(useGuestCartStore.getState().items).toHaveLength(1);
    const stored = JSON.parse(window.localStorage.getItem(GUEST_CART_STORAGE_KEY));
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('course-1');
  });

  it('does not add the same course id twice', () => {
    useGuestCartStore.getState().add(item('course-1'));
    useGuestCartStore.getState().add(item('course-1'));

    expect(useGuestCartStore.getState().items).toHaveLength(1);
  });

  it('removes an item', () => {
    useGuestCartStore.getState().add(item('course-1'));
    useGuestCartStore.getState().remove('course-1');

    expect(useGuestCartStore.getState().items).toEqual([]);
    expect(JSON.parse(window.localStorage.getItem(GUEST_CART_STORAGE_KEY))).toEqual([]);
  });

  it('caps the cart at 50 items', () => {
    for (let i = 0; i < GUEST_CART_MAX_ITEMS + 5; i++) {
      useGuestCartStore.getState().add(item(`course-${i}`));
    }

    expect(useGuestCartStore.getState().items).toHaveLength(GUEST_CART_MAX_ITEMS);
  });

  it('ignores an item missing required fields rather than crashing', () => {
    useGuestCartStore.getState().add({ id: 'course-1' }); // no title
    useGuestCartStore.getState().add(null);

    expect(useGuestCartStore.getState().items).toEqual([]);
  });

  it('clear() empties the cart and localStorage', () => {
    useGuestCartStore.getState().add(item('course-1'));
    useGuestCartStore.getState().clear();

    expect(useGuestCartStore.getState().items).toEqual([]);
    expect(window.localStorage.getItem(GUEST_CART_STORAGE_KEY)).toBe('[]');
  });

  it('drops corrupt localStorage content on read rather than throwing', () => {
    window.localStorage.setItem(GUEST_CART_STORAGE_KEY, 'not json');
    useGuestCartStore.getState().syncFromStorageEvent({ key: GUEST_CART_STORAGE_KEY });

    expect(useGuestCartStore.getState().items).toEqual([]);
  });

  it('syncFromStorageEvent re-reads only when the event is for this key', () => {
    window.localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify([item('course-9')]));
    useGuestCartStore.getState().syncFromStorageEvent({ key: 'some-other-key' });
    expect(useGuestCartStore.getState().items).toEqual([]);

    useGuestCartStore.getState().syncFromStorageEvent({ key: GUEST_CART_STORAGE_KEY });
    expect(useGuestCartStore.getState().items).toHaveLength(1);
  });
});
