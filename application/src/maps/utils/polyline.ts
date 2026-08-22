/* eslint-disable no-bitwise */

import type { LatLng } from '../types';

const COORDINATE_SCALE = 1e5;

const ASCII_OFFSET = 63;

const CONTINUATION_BIT = 0x20;

const CHUNK_BITS = 5;
const CHUNK_MASK = 0x1f;

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

  const value = result & 1 ? ~(result >> 1) : result >> 1;
  return { value, nextIndex: cursor };
};

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
