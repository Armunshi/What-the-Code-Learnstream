// Visually hidden until focused, per plan §5.1 ("nothing hidden without an
// alternative path") — the first tab stop on every page, letting a keyboard
// or screen-reader user jump past the header straight to the page content.
// RootLayout's <Outlet/> has no id of its own to target (it's frozen,
// app/layouts/**, not owned by this lane), so this targets the "main"
// landmark role instead, which every page's own top-level element already
// satisfies via its semantics rather than a specific id.
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:ring-2 focus:ring-ring"
    >
      Skip to content
    </a>
  );
}

export default SkipToContent;
