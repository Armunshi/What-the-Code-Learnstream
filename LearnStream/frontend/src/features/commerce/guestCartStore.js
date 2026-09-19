import { create } from 'zustand';

// Guest cart persistence (plan §2.3): localStorage key
// `learnstream:guestCart:v1`, validated on read, capped at 50 items,
// synced across tabs via the browser's `storage` event. Stores full
// CourseCardDTOs (not just ids) so the cart can render itself with no
// extra fetch — `useCart().add()` is frozen to take a full DTO for exactly
// this reason (docs/contracts/stubs.md).
export const GUEST_CART_STORAGE_KEY = 'learnstream:guestCart:v1';
export const GUEST_CART_MAX_ITEMS = 50;

function isValidGuestCartItem(item) {
  return Boolean(item) && typeof item === 'object' && typeof item.id === 'string' && typeof item.title === 'string';
}

function readFromStorage() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(GUEST_CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // A corrupt or hand-edited entry never crashes the cart — it's silently
    // dropped instead of rendering a broken card.
    return parsed.filter(isValidGuestCartItem).slice(0, GUEST_CART_MAX_ITEMS);
  } catch {
    return [];
  }
}

function writeToStorage(items) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage full or unavailable (private browsing) — the in-memory store
    // still works for the rest of this tab session, it just won't persist.
  }
}

export const useGuestCartStore = create((set, get) => ({
  items: readFromStorage(),

  add: (courseCardDto) => {
    if (!isValidGuestCartItem(courseCardDto)) return;
    const { items } = get();
    if (items.some((item) => item.id === courseCardDto.id)) return;
    if (items.length >= GUEST_CART_MAX_ITEMS) return;
    const next = [...items, courseCardDto];
    writeToStorage(next);
    set({ items: next });
  },

  remove: (id) => {
    const next = get().items.filter((item) => item.id !== id);
    writeToStorage(next);
    set({ items: next });
  },

  clear: () => {
    writeToStorage([]);
    set({ items: [] });
  },

  // Re-reads localStorage when ANOTHER tab wrote to this key — the
  // `storage` event never fires in the tab that made the write itself, only
  // in other tabs of the same origin, which is exactly the cross-tab sync
  // useCart()'s guest mode needs.
  syncFromStorageEvent: (event) => {
    if (event.key !== GUEST_CART_STORAGE_KEY) return;
    set({ items: readFromStorage() });
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => useGuestCartStore.getState().syncFromStorageEvent(event));
}

export default useGuestCartStore;
