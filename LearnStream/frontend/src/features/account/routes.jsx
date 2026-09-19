import { Navigate } from 'react-router-dom';
import RequireAuth from '@/app/guards/RequireAuth';
import { AccountLayout } from './AccountLayout.jsx';
import { ProfileTab } from './tabs/ProfileTab.jsx';
import { PhotoTab } from './tabs/PhotoTab.jsx';
import { SecurityTab } from './tabs/SecurityTab.jsx';
import { PurchasesTab } from './tabs/PurchasesTab.jsx';
import { SubscriptionsTab } from './tabs/SubscriptionsTab.jsx';
import { PaymentMethodsTab } from './tabs/PaymentMethodsTab.jsx';
import { PrivacyTab } from './tabs/PrivacyTab.jsx';

// /account/* — any authenticated role (RequireAuth, not RequireRole), nested
// tabs under AccountLayout's <Outlet/>. security/subscriptions/payment-
// methods render real pages that are themselves partly-or-fully ComingSoon
// per the plan, not routes that are missing outright.
export default [
  {
    path: 'account',
    element: <RequireAuth />,
    children: [
      {
        element: <AccountLayout />,
        children: [
          { index: true, element: <Navigate to="profile" replace /> },
          { path: 'profile', element: <ProfileTab /> },
          { path: 'photo', element: <PhotoTab /> },
          { path: 'security', element: <SecurityTab /> },
          { path: 'purchases', element: <PurchasesTab /> },
          { path: 'subscriptions', element: <SubscriptionsTab /> },
          { path: 'payment-methods', element: <PaymentMethodsTab /> },
          { path: 'privacy', element: <PrivacyTab /> },
        ],
      },
    ],
  },
];
