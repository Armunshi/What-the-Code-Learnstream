import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';

// Nested-tab layout for /account/* (the plan's "nested tabs" requirement).
// Hand-rolled nav rather than the shadcn Tabs primitive: Tabs owns its own
// active-panel state via TabsContent, which doesn't compose with
// route-driven content from <Outlet/> — a plain NavLink strip styled like
// the design system's tabs gets the same look without fighting that.
const TABS = [
  { to: 'profile', label: 'Profile' },
  { to: 'photo', label: 'Photo' },
  { to: 'security', label: 'Security' },
  { to: 'purchases', label: 'Purchases' },
  { to: 'subscriptions', label: 'Subscriptions' },
  { to: 'payment-methods', label: 'Payment methods' },
  { to: 'privacy', label: 'Privacy' },
];

export function AccountLayout() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Account settings</h1>
      <nav aria-label="Account sections" className="flex flex-wrap gap-1 border-b" data-testid="account-tabs">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                'rounded-t-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground',
                isActive && 'border-b-2 border-primary text-foreground'
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <div className="pb-10">
        <Outlet />
      </div>
    </div>
  );
}

export default AccountLayout;
