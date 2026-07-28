/* eslint-disable no-bitwise -- The encoded-polyline format IS a bit-packing
 * scheme: 5-bit chunks, a continuation flag in bit 6, and zig-zag sign
 * encoding. Expressing it with arithmetic instead of shifts and masks would be
 * slower and far harder to check against Google's published specification. */

/**
 * src/maps/utils/polyline.ts — decoder for Google's Encoded Polyline Algorithm.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The Directions API does not return a route as a JSON array of coordinates —
 * a cross-country route would be megabytes. It returns a single ASCII string in
 * Google's encoded-polyline format, typically ~10× smaller.
 *
 * We decode it here rather than pulling in `@mapbox/polyline` because the
 * algorithm is 30 lines, has been stable since 2007, and a dependency in the
 * hot path of a live-tracking screen is a dependency we have to audit and
 * update forever.
 *
 * THE FORMAT (https://developers.google.com/maps/documentation/utilities/polylinealgorithm):
 *   1. Values are latitude/longitude DELTAS from the previous point, ×1e5,
 *      rounded to integers — so consecutive points encode to very few bytes.
 *   2. Each integer is zig-zag encoded (negatives interleaved with positives),
 *      then split into 5-bit chunks, least-significant first.
 *   3. Every chunk except the last has bit 6 set (continuation), and 63 is
 *      added so the result lands in printable ASCII.
 * Decoding reverses those steps.
 */

import type { LatLng } from '../types';

/** Deltas are transmitted as integers scaled by 1e5 (≈ 1 m precision). */
const COORDINATE_SCALE = 1e5;

/** 63 (`?`) is added on encode to move chunks into the printable ASCII range. */
const ASCII_OFFSET = 63;

/** Bit 6 (0x20) marks "another 5-bit chunk follows". */
const CONTINUATION_BIT = 0x20;

/** Each chunk carries 5 payload bits. */
const CHUNK_BITS = 5;
const CHUNK_MASK = 0x1f;

/**
 * Reads one zig-zag encoded varint starting at `index`.
 * Returns the decoded value and the index just past the value's last chunk.
 */
const readValue = (encoded: string, index: number): { value: number; nextIndex: number } => {
  let cursor = index;
  let shift = 0;
  let result = 0;
  let chunk = 0;

  do {
    chunk = encoded.charCodeAt(cursor) - ASCII_OFFSET;
    cursor += 1;
    result |= (chunk & CHUNK_MASK) << shift;
    shift += CHUNK_BITS;
  } while (chunk >= CONTINUATION_BIT && cursor < encoded.length);

  // Un-zig-zag: odd values encode negatives (…, -2 → 3, -1 → 1, 0 → 0, 1 → 2).
  const value = result & 1 ? ~(result >> 1) : result >> 1;
  return { value, nextIndex: cursor };
};

/**
 * Decodes an encoded polyline into absolute coordinates.
 *
 * Malformed input yields the points decoded so far rather than throwing: a
 * corrupt route should degrade to a shorter line on screen, never crash a
 * tracking screen the user is actively watching.
 */
export const decodePolyline = (encoded: string): LatLng[] => {
  if (!encoded) {
    return [];
  }

  const points: LatLng[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    const lat = readValue(encoded, index);
    if (lat.nextIndex >= encoded.length && points.length === 0 && lat.nextIndex === index) {
      break;
    }
    index = lat.nextIndex;
    latitude += lat.value;

    if (index >= encoded.length) {
      break;
    }

    const lng = readValue(encoded, index);
    index = lng.nextIndex;
    longitude += lng.value;

    points.push({
      latitude: latitude / COORDINATE_SCALE,
      longitude: longitude / COORDINATE_SCALE,
    });
  }

  return points;
};
