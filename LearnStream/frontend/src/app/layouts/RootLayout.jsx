import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { OutletErrorBoundary } from '@/app/OutletErrorBoundary';
// SiteFooter (frontend/src/components/layout/SiteFooter.jsx) belongs to NAV's
// ownership of components/layout/** — it doesn't exist yet in Wave 0. The
// pre-existing legacy Footer fills that slot for now; NAV can swap this one
// import once it lands its own SiteFooter, without RootLayout's own shape
// changing.
import Footer from '@/components/Footer.jsx';

// The new-tree layout (plan §1.1): SiteHeader, <Outlet/> wrapped in Suspense
// + an error boundary (so a lazy feature route or a render error doesn't
// blank the whole shell), SiteFooter. Mounted around the features/*/routes.jsx
// registry in app/router.jsx — the legacy route tree keeps using its own
// Layout.jsx unchanged.
export function RootLayout() {
  return (
    <>
      <SiteHeader />
      <OutletErrorBoundary>
        <Suspense fallback={<div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>}>
          <Outlet />
        </Suspense>
      </OutletErrorBoundary>
      <Footer />
    </>
  );
}

export default RootLayout;
