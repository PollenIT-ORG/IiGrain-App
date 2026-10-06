import { useEffect, useRef } from "react";

// Fills a form from a fetched record once it has loaded, never again for the same record, so typed text is not replaced by a background refresh.
export function useSeedOnce<T>(
  value: T | undefined,
  key: string | undefined,
  loading: boolean,
  apply: (value: T) => void
): void {
  const seeded = useRef<string | null>(null);
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    if (value === undefined || key === undefined || loading) return;
    if (seeded.current === key) return;
    seeded.current = key;
    applyRef.current(value);
  }, [value, key, loading]);
}
