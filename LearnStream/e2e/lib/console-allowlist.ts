// Known, accepted console noise — not a bug any individual flow test here
// is trying to catch, so it's filtered out of "no unexpected console
// errors" assertions rather than drowning genuinely new errors.
//
// AuthProvider.jsx calls fetchNewAccessToken() unconditionally on EVERY
// page mount, even for a fully anonymous visitor with no refresh cookie at
// all — confirmed live: a completely unauthenticated Home-page load still
// fires a failing POST /auth/refresh-Token and logs the failure. That's a
// real, separate finding worth its own UI_AUDIT.md entry (the refresh
// attempt should be conditional on some hint a session might exist), but
// it isn't the thing lecture-completion or course-navigation tests exist
// to catch.
// AddToCartBtn.jsx renders on every course-detail page and checks cart
// presence on mount. cart.controller.js's getCart 404s for any student who
// has never added anything to their cart yet — already documented as
// BACKEND_AUDIT.md §3.5 ("Empty cart returns 404"). Confirmed live via this
// suite's fixture student (freshly seeded, never touched a cart). Not
// something any of the 4 in-scope flows are testing for.
export const KNOWN_CONSOLE_NOISE: RegExp[] = [
  /auth\/refresh-Token/,
  /Error refreshing access token/,
  /courses\/cart/,
  /Error checking cart presence/,
];
