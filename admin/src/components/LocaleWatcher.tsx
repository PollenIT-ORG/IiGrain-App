import { Fragment, useSyncExternalStore, type ReactNode } from "react";
import { subscribeToLocale, getLocaleVersion } from "../lib/datetime";

/**
 * Redraws the panel when the organization's timezone or clock changes.
 *
 * Dates are formatted by plain functions rather than a hook, which keeps every
 * screen simple but means nothing knows to repaint on its own. Sitting above
 * the routes, this repaints them the moment the setting is saved - on this
 * tab, and on everyone else's as soon as the change reaches them.
 *
 * The version is the key rather than only a re-render: the routes arrive as
 * the children prop, so React would otherwise reuse them untouched and every
 * date on screen would keep the old clock until the next navigation. The URL
 * is held by the router above this, so the page stays where it was, and the
 * data it needs is already in the query cache.
 */
export default function LocaleWatcher({ children }: { children: ReactNode }) {
  const version = useSyncExternalStore(
    subscribeToLocale,
    getLocaleVersion,
    getLocaleVersion
  );
  return <Fragment key={version}>{children}</Fragment>;
}
