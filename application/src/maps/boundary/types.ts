/**
 * src/maps/boundary/types.ts — the vocabulary of the Farm Boundary module.
 *
 * See docs/maps/FarmBoundary/DATA_MODEL.md for the full model. Two shapes matter:
 *   - DraftBoundary — the EPHEMERAL editing state (the engine's state).
 *   - FieldBoundary — the COMMITTED, persisted boundary (Redux + storage).
 *
 * Coordinates are the map module's own `LatLng`, so nothing here introduces a
 * second coordinate type.
 */

import type { LatLng } from '../types';

// ── The committed boundary ───────────────────────────────────────────────────

/** Where a saved boundary currently lives. Phase D is always `'local'`; the
 *  other values are reserved for the Phase-E sync layer so no data migration is
 *  needed to turn sync on (see DATA_MODEL §2). */
export type BoundarySyncStatus = 'local' | 'pending' | 'synced' | 'conflict';

/** Axis-aligned extent, persisted for cheap "near X" filtering before any
 *  spatial index exists. */
export interface BoundaryBBox {
  readonly minLat: number;
  readonly minLng: number;
  readonly maxLat: number;
  readonly maxLng: number;
}

/**
 * A field's committed boundary. This is the "foundation" every future GIS layer
 * clips to. `ring` is stored OPEN (first point not repeated) — the module's one
 * ring representation; GeoJSON's closed form only exists at the serializer
 * boundary.
 */
export interface FieldBoundary {
  readonly fieldId: string;
  readonly farmId: string;
  readonly orgId: string | null;
  /** Ordered vertices, open ring (no duplicated closing point). */
  readonly ring: readonly LatLng[];
  /** Absolute area in m², computed once by geo.polygonAreaSqMeters and stored so
   *  the displayed and persisted areas can never disagree. */
  readonly areaSqM: number;
  readonly center: LatLng;
  readonly bbox: BoundaryBBox;
  /** Monotonic per field. The optimistic-concurrency token for future sync. */
  readonly version: number;
  readonly syncStatus: BoundarySyncStatus;
  /** ISO, device clock — informational. */
  readonly updatedAt: string;
}

// ── The editing draft (engine state) ─────────────────────────────────────────

/** Enough to restore the ring for undo/redo. */
export interface BoundarySnapshot {
  readonly ring: readonly LatLng[];
  readonly closed: boolean;
}

/**
 * The editor's live state. Ephemeral — it lives in the screen via
 * `useBoundaryDraft`, never in Redux (only the committed FieldBoundary is).
 */
export interface DraftBoundary {
  /** Ordered vertices being drawn/edited, open ring. */
  readonly ring: readonly LatLng[];
  /** Has the user finished the ring (DRAW → EDIT)? */
  readonly closed: boolean;
  /** Index of the selected vertex in EDIT mode, or null. */
  readonly selected: number | null;
  /** Undo stack (most recent last). */
  readonly past: readonly BoundarySnapshot[];
  /** Redo stack (most recent last). */
  readonly future: readonly BoundarySnapshot[];
}

// ── Validation ───────────────────────────────────────────────────────────────

/** Why a draft cannot be saved. `null` fields mean that check passed. */
export interface BoundaryValidation {
  readonly isValid: boolean;
  /** Human-readable reason for the first failing rule, for the toolbar. */
  readonly reason: string | null;
  /** ≥ 3 distinct vertices. */
  readonly hasMinVertices: boolean;
  /** Area is above the floor (not degenerate/near-zero). */
  readonly hasArea: boolean;
  /** No two non-adjacent edges cross. */
  readonly isSimple: boolean;
  /** Edge-index pairs that cross, so the UI can highlight them. */
  readonly selfIntersections: ReadonlyArray<readonly [number, number]>;
}

// ── GeoJSON (the wire / storage format) ──────────────────────────────────────

/** A GeoJSON Polygon. `coordinates[0]` is the outer ring, in [lng, lat] order,
 *  CLOSED (first == last). Holes (`coordinates[1..]`) are Phase-E. */
export interface GeoJSONPolygon {
  readonly type: 'Polygon';
  readonly coordinates: ReadonlyArray<ReadonlyArray<readonly [number, number]>>;
}

/** The editor's four interaction modes. See docs/maps/FarmBoundary/UX.md §2. */
export type BoundaryMode = 'view' | 'draw' | 'edit';
