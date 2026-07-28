import { useEffect, useState } from 'react';

/** Debounces a rapidly-changing value (typically a search box) so paginated
 *  list endpoints are not hit on every keystroke. */
export const useDebouncedValue = <T>(value: T, delayMs = 400): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (value === debounced) {
      return;
    }
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs, debounced]);

  return debounced;
};

export default useDebouncedValue;
