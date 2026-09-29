import type { ConnectivityProvider } from './types';

export const optimisticConnectivity: ConnectivityProvider = {
  isOnline: async () => true,
};

export const offlineConnectivity: ConnectivityProvider = {
  isOnline: async () => false,
};

export const createManualConnectivity = (
  initialOnline = true,
): ConnectivityProvider & { setOnline(online: boolean): void } => {
  let online = initialOnline;
  const listeners = new Set<(next: boolean) => void>();

  return {
    isOnline: async () => online,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setOnline(next: boolean) {
      if (online === next) {
        return;
      }
      online = next;
      listeners.forEach(listener => listener(next));
    },
  };
};
