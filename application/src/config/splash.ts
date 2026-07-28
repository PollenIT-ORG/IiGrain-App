import { COLORS } from '../constants';

/**
 * Single source of truth for the launch experience. Every layer that can paint
 * during startup reads `SPLASH.backgroundColor` so the hand-off from the native
 * window → redux-persist rehydration → the splash never shows a colour change.
 *
 * If you swap in artwork that is dark, change the colour here AND the matching
 * `android:windowBackground` in
 * `android/app/src/main/res/values/styles.xml` — they must agree.
 */
export const SPLASH = {
  /** Painted behind the artwork and by every pre-splash layer. */
  backgroundColor: COLORS.white,

  /**
   * How long the splash stays up — the loader bar fills over exactly this span
   * and its completion is what releases the splash, so the bar always reaches
   * 100% rather than being cut off mid-travel.
   *
   * `RootNavigator` additionally waits for initialisation to finish, so this is
   * a floor on the splash, not a delay added on top of it.
   */
  holdMs: 5000,
} as const;
