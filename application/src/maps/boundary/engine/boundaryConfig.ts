/**
 * src/maps/boundary/engine/boundaryConfig.ts — every tunable number the engine
 * and editor use, in one reviewable place (the module's standing rule; mirrors
 * src/maps/config/mapDefaults.ts).
 */

/** Minimum vertices for a valid polygon. */
export const MIN_VERTICES = 3;

/**
 * A drawn area below this (m²) is treated as degenerate — a mis-tap, not a
 * field. 10 m² ≈ a 3 m × 3 m square.
 */
export const MIN_AREA_SQM = 10;

/**
 * Soft warning threshold on vertex count (open question Q5). Above this the UI
 * may nudge, but never blocks — a genuinely complex field can need many points.
 */
export const SOFT_MAX_VERTICES = 500;

/**
 * Two taps closer than this (degrees, ≈ 2 m at the equator) are the same point —
 * prevents a double-tap creating coincident vertices. Reuses the map module's
 * SAME_SPOT epsilon scale.
 */
export const DUPLICATE_VERTEX_EPSILON = 2e-5;

/** Undo/redo depth. Snapshots are shallow LatLng[] copies — cheap. */
export const UNDO_LIMIT = 30;

/**
 * Snap-to-first-vertex radius, in points (screen space). A tap within this of
 * vertex 0 closes the ring. Converted to a distance at the current zoom by the
 * screen, not here — the engine is coordinate-only.
 */
export const CLOSE_SNAP_RADIUS_PT = 24;
