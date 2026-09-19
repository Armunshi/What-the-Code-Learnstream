import { useEffect, useState } from 'react';

// Returns `value`, but only after it has stopped changing for `delayMs`.
// Used for search-as-you-type (GlobalSearch's 200ms debounce) and similar
// inputs where firing a request on every keystroke would be wasteful.
export function useDebouncedValue(value, delayMs = 200) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export default useDebouncedValue;
