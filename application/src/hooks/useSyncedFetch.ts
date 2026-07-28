import { useEffect, useMemo, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { useAppSelector } from '../redux/hooks';
import { selectTagStamp } from '../redux/slices/syncSlice';

export interface UseSyncedFetchOptions {
  /** Cache tags this screen's data depends on. Build them with `Tags`. */
  tags: readonly string[];
  /** Dispatches the fetch. May change identity freely — it is read via a ref. */
  run: () => void;
  /**
   * Whether the cache already holds this screen's data. Only consulted for the
   * very first run, so a screen whose data another screen already loaded does
   * not refetch it on open.
   */
  hasData: boolean;
  /** Refetch if the last fetch is older than this. 0 disables time-based staleness. */
  ttlMs?: number;
  /** Set false while route params/ids are not ready yet. */
  enabled?: boolean;
}

/**
 * Fetch-on-demand with cache tags — the replacement for "refetch on every
 * mount/focus".
 *
 * It runs `run()` when, and only when:
 *   1. the screen is focused for the first time and nothing is cached, or
 *   2. one of its tags was invalidated (a socket `sync` event, a local write, or
 *      a reconnect epoch bump), or
 *   3. `ttlMs` has elapsed since the last fetch.
 *
 * So opening a screen or switching tabs costs zero requests when the data is
 * already fresh, while a change on another device still lands immediately —
 * the tag bump re-runs this effect while the screen is focused, and an
 * unfocused screen picks it up the moment it is focused again.
 *
 * A failed fetch does NOT retry on every render: after the first attempt the
 * hook only reacts to tag/TTL changes, so `hasData` staying false cannot loop.
 * Surface a retry through pull-to-refresh instead.
 */
export const useSyncedFetch = ({
  tags,
  run,
  hasData,
  ttlMs = 0,
  enabled = true,
}: UseSyncedFetchOptions): void => {
  const isFocused = useIsFocused();

  // Join to a primitive so a fresh array literal each render cannot re-trigger.
  const tagKey = tags.join('|');
  const tagList = useMemo(() => (tagKey ? tagKey.split('|') : []), [tagKey]);
  const stamp = useAppSelector(state => selectTagStamp(state, tagList));

  const runRef = useRef(run);
  runRef.current = run;
  const hasDataRef = useRef(hasData);
  hasDataRef.current = hasData;

  const lastStamp = useRef<number | null>(null);
  const lastRunAt = useRef(0);

  // Route params changed (different field/farm/program) — treat as a new screen.
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
      // Something else already loaded it — adopt the cache, do not refetch.
      if (!hasDataRef.current) {
        runRef.current();
      }
      return;
    }

    const invalidated = lastStamp.current !== stamp;
    const expired = ttlMs > 0 && now - lastRunAt.current > ttlMs;
    if (invalidated || expired) {
      lastStamp.current = stamp;
      lastRunAt.current = now;
      runRef.current();
    }
  }, [enabled, isFocused, stamp, ttlMs]);
};
