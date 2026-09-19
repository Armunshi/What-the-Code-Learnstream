import { Link } from 'react-router-dom';

// The real SiteFooter (plan §4 "W1-NAV Site header" task list), replacing
// the legacy components/Footer.jsx that RootLayout falls back to today.
// RootLayout.jsx (frontend/src/app/layouts/**) isn't owned by this lane —
// see the final report's flagged amendments — so this component exists but
// isn't wired into RootLayout yet; the integrator (or whichever amendment
// lands first) swaps the import once this lane merges.
const FOOTER_SECTIONS = [
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Services', to: '/services' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Contact', to: '/contact' },
    ],
  },
  {
    title: 'Learn',
    links: [
      { label: 'Explore courses', to: '/' },
      { label: 'Teach on LearnStream', to: '/teach' },
      { label: 'My learning', to: '/my-learning' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy policy', to: '/privacy' },
      { label: 'Terms & conditions', to: '/terms' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer role="contentinfo" className="border-t bg-background">
      <div className="mx-auto grid max-w-container gap-8 px-4 py-10 sm:grid-cols-2 md:px-8 lg:grid-cols-4">
        <div>
          <Link to="/" className="font-league text-xl font-bold">
            <span className="text-brand">Learn</span>Stream
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Learn new skills online, taught by real-world experts.
          </p>
        </div>

        {FOOTER_SECTIONS.map((section) => (
          <div key={section.title}>
            <h2 className="mb-4 text-sm font-semibold uppercase text-foreground">{section.title}</h2>
            <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
              {section.links.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="hover:text-foreground hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t">
        <div className="mx-auto max-w-container px-4 py-4 text-sm text-muted-foreground md:px-8">
          © {new Date().getFullYear()} LearnStream. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
