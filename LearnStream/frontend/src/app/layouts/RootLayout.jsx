import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { OutletErrorBoundary } from '@/app/OutletErrorBoundary';
import { SiteFooter } from '@/components/layout/SiteFooter';

// The new-tree layout (plan §1.1): SiteHeader, <Outlet/> wrapped in Suspense
// + an error boundary (so a lazy feature route or a render error doesn't
// blank the whole shell), SiteFooter. Mounted around the features/*/routes.jsx
// registry in app/router.jsx — the legacy route tree keeps using its own
// Layout.jsx unchanged.
//
// #main-content is SkipToContent's target (SiteHeader/SkipToContent.jsx) —
// it had nowhere to jump to until NAV's SiteHeader landed with that link.
export function RootLayout() {
  return (
    <>
      <SiteHeader />
      <OutletErrorBoundary>
        <Suspense fallback={<div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>}>
          <main id="main-content">
            <Outlet />
          </main>
        </Suspense>
      </OutletErrorBoundary>
      <SiteFooter />
    </>
  );
}

export default RootLayout;
