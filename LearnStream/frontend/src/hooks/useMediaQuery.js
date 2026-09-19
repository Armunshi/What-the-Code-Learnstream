import { useEffect, useState } from 'react';

// Subscribes to a CSS media query (e.g. `(min-width: 768px)`) and re-renders
// on change — the standard way responsive layout decisions (SiteHeader's
// breakpoints, touch-vs-pointer popover behavior) get made in JS instead of
// pure CSS.
export function useMediaQuery(query) {
  const getMatch = () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(getMatch);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQueryList = window.matchMedia(query);
    const listener = (event) => setMatches(event.matches);

    setMatches(mediaQueryList.matches);
    mediaQueryList.addEventListener('change', listener);
    return () => mediaQueryList.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

export default useMediaQuery;
