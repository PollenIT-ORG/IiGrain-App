import { useEffect, useMemo, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { useAppSelector } from '../redux/hooks';
import { selectTagStamp } from '../redux/slices/syncSlice';

export interface UseSyncedFetchOptions {
  tags: readonly string[];
  run: () => void;
  hasData: boolean;
  ttlMs?: number;
  enabled?: boolean;
}

const lastFetchedStamp = new Map<string, number>();

export const useSyncedFetch = ({
  tags,
  run,
  hasData,
  ttlMs = 0,
  enabled = true,
}: UseSyncedFetchOptions): void => {
  const isFocused = useIsFocused();

  const tagKey = tags.join('|');
  const tagList = useMemo(() => (tagKey ? tagKey.split('|') : []), [tagKey]);
  const stamp = useAppSelector(state => selectTagStamp(state, tagList));

  const runRef = useRef(run);
  runRef.current = run;
  const hasDataRef = useRef(hasData);
  hasDataRef.current = hasData;

  const lastStamp = useRef<number | null>(null);
  const lastRunAt = useRef(0);

  useEffect(() => {
    lastStamp.current = null;
    lastRunAt.current = 0;
  }, [tagKey]);

  useEffect(() => {
    if (!enabled || !isFocused) {
      return;
    }
    const now = Date.now();

    if (lastStamp.current === null) {
      lastStamp.current = stamp;
      lastRunAt.current = now;
      const fetchedAt = lastFetchedStamp.get(tagKey);
      if (!hasDataRef.current || fetchedAt !== stamp) {
        lastFetchedStamp.set(tagKey, stamp);
        runRef.current();
      }
      return;
    }

    const invalidated = lastStamp.current !== stamp;
    const expired = ttlMs > 0 && now - lastRunAt.current > ttlMs;
    if (invalidated || expired) {
      lastStamp.current = stamp;
      lastRunAt.current = now;
      lastFetchedStamp.set(tagKey, stamp);
      runRef.current();
    }
  }, [enabled, isFocused, stamp, ttlMs, tagKey]);
};
