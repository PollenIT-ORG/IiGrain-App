import type { MapStyleElement } from 'react-native-maps';

export const AGRI_MAP_STYLE: MapStyleElement[] = [
  {
    featureType: 'poi.business',
    elementType: 'all',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit',
    elementType: 'all',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ saturation: -40 }, { lightness: 10 }],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry',
    stylers: [{ saturation: -25 }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ saturation: -20 }, { lightness: 5 }],
  },
];

export const AGRI_MAP_STYLE_PREVIEW: MapStyleElement[] = [
  ...AGRI_MAP_STYLE,
  {
    featureType: 'road',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
];
