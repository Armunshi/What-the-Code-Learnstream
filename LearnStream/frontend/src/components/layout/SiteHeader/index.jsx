import { Link } from 'react-router-dom';

// Frozen stub (docs/contracts/stubs.md #SiteHeader) — W0-A creates the file
// and locks the "no props, everything reads its own hooks" contract; NAV
// replaces this body in Wave 1 with the full composition (SkipToContent,
// MobileNavSheet, Logo, ExploreMenu, GlobalSearch, TeachLink, CartButton,
// AuthCtas/UserMenu). Kept intentionally minimal here so RootLayout has a
// real, non-empty header to mount in the meantime.
export function SiteHeader() {
  return (
    <header role="banner" className="sticky top-0 z-40 h-16 border-b bg-background">
      <div className="mx-auto flex h-full max-w-container items-center px-4 md:px-8">
        <Link to="/" className="font-league text-xl font-bold">
          <span className="text-brand">Learn</span>Stream
        </Link>
      </div>
    </header>
  );
}

export default SiteHeader;
