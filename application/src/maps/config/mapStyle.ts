/**
 * src/maps/config/mapStyle.ts — the branded Google base-map style.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Google's stock road map is optimised for urban navigation: saturated
 * motorways, dense POI icons, strong commercial-area shading. On an agriculture
 * screen that visual weight competes with the thing that actually matters — the
 * farm pin and the field boundary.
 *
 * This style array mutes everything the app does not need and leaves the green
 * of vegetation/parks intact, so the map reads as land rather than as a city.
 *
 * HOW IT IS APPLIED
 *   AppMapView passes it as `customMapStyle`. That prop is honoured by the
 *   Google renderer on BOTH platforms — which is precisely why the project pins
 *   iOS to Google as well (Apple MapKit ignores it, and the two platforms would
 *   drift apart visually). See docs/maps/README.md.
 *
 * HOW TO EDIT IT
 *   Do not hand-write these objects. Use https://mapstyle.withgoogle.com/,
 *   export the JSON, and paste it below. The `MapStyleElement` type is
 *   structural, so a paste that type-checks is a valid style.
 *
 * SATELLITE / HYBRID NOTE
 *   `customMapStyle` only affects vector base maps. It is silently ignored when
 *   `mapType` is `satellite` or `hybrid` — that is a Google SDK behaviour, not
 *   a bug in this file.
 */

import type { MapStyleElement } from 'react-native-maps';

/**
 * Muted agricultural base map.
 *
 * Each entry documents its intent, because a bare styler array is unreadable
 * six months later.
 */
export const AGRI_MAP_STYLE: MapStyleElement[] = [
  // Hide business/POI icons and labels: shops and restaurants are pure noise
  // when the user is placing a field boundary.
  {
    featureType: 'poi.business',
    elementType: 'all',
    stylers: [{ visibility: 'off' }],
  },
  // Keep parks/vegetation visible but unlabelled — the shape is useful context,
  // the name is not.
  {
    featureType: 'poi.park',
    elementType: 'labels.text',
    stylers: [{ visibility: 'off' }],
  },
  // Transit is irrelevant to farmland and adds strong coloured lines.
  {
    featureType: 'transit',
    elementType: 'all',
    stylers: [{ visibility: 'off' }],
  },
  // Desaturate motorways so the brand-green route polyline is the most
  // saturated thing on screen.
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ saturation: -40 }, { lightness: 10 }],
  },
  // Local roads matter for reaching a field — keep them, just quieter.
  {
    featureType: 'road.local',
    elementType: 'geometry',
    stylers: [{ saturation: -25 }],
  },
  // Soften water so it does not out-compete the pin.
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ saturation: -20 }, { lightness: 5 }],
  },
];

/**
 * Style used for non-interactive preview maps (field detail cards).
 *
 * Same base, plus road labels dropped: at preview size the labels overlap the
 * marker and become unreadable smudges.
 */
export const AGRI_MAP_STYLE_PREVIEW: MapStyleElement[] = [
  ...AGRI_MAP_STYLE,
  {
    featureType: 'road',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
];
