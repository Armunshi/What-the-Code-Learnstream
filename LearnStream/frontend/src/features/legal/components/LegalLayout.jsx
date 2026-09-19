import { Link } from 'react-router-dom';

// Shared shell for the Privacy Policy and Terms & Conditions pages: a title,
// a "last updated" stamp, a jump-to-section nav built from `sections`, and
// consistent prose styling for the section bodies both pages render into it.
export function LegalLayout({ title, lastUpdated, intro, sections, children }) {
  return (
    <div className="mx-auto max-w-container px-4 py-12 md:px-8 md:py-16">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-extrabold text-foreground sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
        {intro && <p className="mt-6 text-base leading-7 text-muted-foreground">{intro}</p>}
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Sections" className="hidden lg:block">
          <ul className="sticky top-24 flex flex-col gap-2 border-l pl-4 text-sm">
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="text-muted-foreground hover:text-foreground hover:underline">
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="max-w-3xl space-y-10">{children}</div>
      </div>

      <p className="mt-16 max-w-3xl border-t pt-6 text-sm text-muted-foreground">
        Questions about this page? Reach us at{' '}
        <a href="mailto:support@learnstream.app" className="text-brand-dark hover:underline">
          support@learnstream.app
        </a>
        , or see our{' '}
        <Link to="/privacy" className="text-brand-dark hover:underline">
          Privacy Policy
        </Link>{' '}
        and{' '}
        <Link to="/terms" className="text-brand-dark hover:underline">
          Terms &amp; Conditions
        </Link>
        .
      </p>
    </div>
  );
}

export function LegalSection({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-base leading-7 text-muted-foreground [&_a]:text-brand-dark [&_a]:hover:underline [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}

export default LegalLayout;
