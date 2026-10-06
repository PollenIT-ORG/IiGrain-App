import { useEffect } from "react";
import { apiSlice, TAG_TYPES, type TagType } from "../store/api";
import { useAppDispatch } from "../store/hooks";
import { getSocket } from "../lib/socket";
import { TAGS_FOR, isChangedResource } from "../lib/liveSync";

// Changes that arrive together are loaded once.
const BATCH_MS = 300;
// While the connection is down, what is on screen is loaded again this often.
const OFFLINE_REFRESH_MS = 30_000;

// Reloads what is on screen when the server announces a change, when the connection returns after a break, and on a timer while it is down.
export default function LiveSync() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const socket = getSocket();
    const pending = new Set<TagType>();
    let batchTimer: number | null = null;
    let offlineTimer: number | null = null;
    let connectedBefore = socket.connected;

    function refresh(tags: readonly TagType[]): void {
      dispatch(apiSlice.util.invalidateTags([...tags]));
    }

    function flush(): void {
      batchTimer = null;
      const tags = [...pending];
      pending.clear();
      if (tags.length) refresh(tags);
    }

    function onChanged(payload: { resource?: unknown }): void {
      const tags = isChangedResource(payload?.resource) ? TAGS_FOR[payload.resource] : TAG_TYPES;
      tags.forEach((t) => pending.add(t));
      if (batchTimer === null) batchTimer = window.setTimeout(flush, BATCH_MS);
    }

    function stopOfflineRefresh(): void {
      if (offlineTimer !== null) window.clearInterval(offlineTimer);
      offlineTimer = null;
    }

    function startOfflineRefresh(): void {
      if (offlineTimer !== null) return;
      offlineTimer = window.setInterval(() => {
        if (!socket.connected) refresh(TAG_TYPES);
      }, OFFLINE_REFRESH_MS);
    }

    function onConnect(): void {
      stopOfflineRefresh();
      // The first connection follows a fresh load. Later ones follow a break.
      if (connectedBefore) refresh(TAG_TYPES);
      connectedBefore = true;
    }

    socket.on("data:changed", onChanged);
    socket.on("connect", onConnect);
    socket.on("disconnect", startOfflineRefresh);
    socket.on("connect_error", startOfflineRefresh);

    return () => {
      socket.off("data:changed", onChanged);
      socket.off("connect", onConnect);
      socket.off("disconnect", startOfflineRefresh);
      socket.off("connect_error", startOfflineRefresh);
      if (batchTimer !== null) window.clearTimeout(batchTimer);
      stopOfflineRefresh();
    };
  }, [dispatch]);

  return null;
}
