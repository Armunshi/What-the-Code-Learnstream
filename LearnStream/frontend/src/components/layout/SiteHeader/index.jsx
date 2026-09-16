import { useContext } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { GlobalSearch } from '@/features/search';
import { CartButton } from '@/features/commerce';
import AuthContext from '@/contexts/AuthProvider';
import { SkipToContent } from './SkipToContent';
import { MobileNavSheet } from './MobileNavSheet';
import { Logo } from './Logo';
import { ExploreMenu } from './ExploreMenu';
import { TeachLink } from './TeachLink';
import { AuthCtas } from './AuthCtas';
import { UserMenu } from './UserMenu';

// The real SiteHeader (docs/contracts/stubs.md #SiteHeader, plan §5.1),
// replacing W0-A's stub body. Composition and element order are frozen —
// GlobalSearch (SRC) and CartButton (COM) are consumed here purely by their
// stub signature, unmodified, so this lane never blocks on those two
// lanes' real implementations landing.
//
// Responsive behavior (plan §5.1's table) is CSS-driven rather than a
// useMediaQuery branch, so there's no client/server layout mismatch and no
// extra re-render on resize:
// - below md: Logo, the GlobalSearch dialog-icon, CartButton, hamburger.
// - md-lg: the inline GlobalSearch fills the middle; Explore/Teach stay in
//   the sheet (hamburger still visible) until lg.
// - lg+: ExploreMenu and TeachLink appear directly; the hamburger hides.
export function SiteHeader() {
  const { status } = useContext(AuthContext);

  return (
    <header role="banner" className="sticky top-0 z-40 h-16 border-b bg-background">
      <div className="mx-auto flex h-full max-w-container items-center gap-2 px-4 md:gap-4 md:px-8">
        <SkipToContent />
        <MobileNavSheet />
        <Logo />
        <ExploreMenu />

        <div className="hidden min-w-0 flex-1 md:flex">
          <GlobalSearch variant="inline" className="w-full min-w-0" />
        </div>
        <div className="md:hidden">
          <GlobalSearch variant="dialog" />
        </div>

        <div className="ml-auto flex items-center gap-2 md:gap-4">
          <TeachLink />
          <CartButton />
          {status === 'unknown' ? (
            <Skeleton className="h-9 w-[160px]" />
          ) : status === 'guest' ? (
            <AuthCtas />
          ) : (
            <UserMenu />
          )}
        </div>
      </div>
    </header>
  );
}

export default SiteHeader;
