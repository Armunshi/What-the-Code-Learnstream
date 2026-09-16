// Global Vitest setup: adds jest-dom's DOM matchers (toBeInTheDocument, etc.)
// to every test file automatically, so individual specs don't each import it.
import '@testing-library/jest-dom/vitest';

// jsdom has never implemented matchMedia (https://github.com/jsdom/jsdom/issues/3522).
// useMediaQuery (hooks/useMediaQuery.js) calls it unconditionally, and any
// component that uses that hook — directly or, like SiteHeader rendering
// the real CartButton, transitively — crashes in every test environment
// without this. A per-test mock would work too, but this hook is shared
// infrastructure any lane's component can end up calling, so the polyfill
// belongs here once rather than copied into every test file that happens
// to render something upstream of it.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
