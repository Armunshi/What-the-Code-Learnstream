// Public API surface of the commerce feature (docs/lanes/com.json owns
// features/commerce/**). W0-A creates this barrel with placeholder bodies
// for the frozen stubs assigned to COM (docs/contracts/stubs.md): the
// `PurchaseCta` component, the `CartButton` component, the `useCart()`
// hook, and the `CartProvider` app/providers.jsx composes. COM replaces
// only these bodies in Wave 1 — the signatures below are frozen.

/**
 * useCart() -> { mode, items, count, isLoading, has(id), add(courseCardDto), remove(id), canPurchase }
 *
 * Stubbed to the 'disabled' shape for Wave 0: no cart exists yet, so nothing
 * that reads this hook (CartButton, SiteHeader) should render cart UI until
 * COM replaces this body.
 */
export function useCart() {
  return {
    mode: 'disabled',
    items: [],
    count: 0,
    isLoading: false,
    has: () => false,
    add: () => {},
    remove: () => {},
    canPurchase: false,
  };
}

// Wraps the app in app/providers.jsx (QueryClientProvider -> AuthProvider ->
// CartProvider -> ...). A no-op passthrough until COM wires up the guest
// cart / server cart state described in plan §2.3.
export function CartProvider({ children }) {
  return children;
}

// PurchaseCta({course, variant}) — state machine keyed on viewer role and
// course state (docs/contracts/stubs.md). Placeholder body only; COM
// implements the Owner/Enrolled/Free/Paid/Teacher states in Wave 1.
export function PurchaseCta({ course, variant = 'default' }) {
  void course;
  void variant;
  return null;
}

// CartButton — hidden by consumers when useCart().mode === 'disabled'.
// Placeholder body only (no JSX here: this file is an `index.js`, not
// `.jsx`, and Vite's build-time import analysis requires literal JSX syntax
// to live in a `.jsx`/`.tsx` file) — COM implements the real markup in
// Wave 1.
export function CartButton() {
  return null;
}
