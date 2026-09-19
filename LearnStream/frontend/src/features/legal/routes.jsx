import { PrivacyPolicy } from './pages/PrivacyPolicy.jsx';
import { TermsConditions } from './pages/TermsConditions.jsx';

// SiteFooter (components/layout/SiteFooter.jsx) has always linked to
// "/privacy" and "/terms" — these routes give those links somewhere to go.
export default [
  { path: 'privacy', element: <PrivacyPolicy /> },
  { path: 'terms', element: <TermsConditions /> },
];
