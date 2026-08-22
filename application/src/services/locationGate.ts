import { confirm } from './confirmService';
import {
  LocationError,
  getCurrentLocation,
  openAppSettings,
  openLocationSettings,
  type Coords,
} from './currentLocation';

interface GateCopy {
  title: string;
  message: string;
  icon: string;
  action?: { label: string; open: () => void };
}

const copyFor = (code: LocationError['code'], purpose: string): GateCopy => {
  switch (code) {
    case 'permission_denied':
      return {
        title: 'Location permission needed',
        message: `iiGrain needs your location to ${purpose}. Allow location access and try again.`,
        icon: 'map-marker-off-outline',
      };
    case 'permission_blocked':
      return {
        title: 'Location permission blocked',
        message: `Location is turned off for iiGrain, so we cannot ${purpose}. Enable it in app settings.`,
        icon: 'lock-outline',
        action: { label: 'Open settings', open: openAppSettings },
      };
    case 'location_services_disabled':
      return {
        title: 'Turn on location',
        message: `Your device's location is switched off, so we cannot ${purpose}. Turn it on and try again.`,
        icon: 'crosshairs-off',
        action: { label: 'Open settings', open: openLocationSettings },
      };
    case 'timeout':
      return {
        title: 'Could not find your location',
        message:
          'Getting a GPS fix took too long. Step into the open, away from buildings, and try again.',
        icon: 'timer-sand',
      };
    default:
      return {
        title: 'Location unavailable',
        message: 'Your device could not report a position. Try again in a moment.',
        icon: 'map-marker-question-outline',
      };
  }
};

export interface LocationGateOptions {
  purpose?: string;
  explain?: boolean;
}

export const ensureTrackingLocation = async ({
  purpose = 'share your live position',
  explain = true,
}: LocationGateOptions = {}): Promise<Coords | null> => {
  try {
    return await getCurrentLocation();
  } catch (error) {
    if (!explain) {
      return null;
    }
    const code =
      error instanceof LocationError ? error.code : 'position_unavailable';
    const { title, message, icon, action } = copyFor(code, purpose);

    const opened = await confirm({
      title,
      message,
      icon,
      confirmLabel: action?.label ?? 'OK',
      cancelLabel: 'Not now',
      acknowledgeOnly: !action,
    });
    if (opened && action) {
      action.open();
    }
    return null;
  }
};
