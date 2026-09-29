import NetInfo from '@react-native-community/netinfo';
import type { NetInfoState } from '@react-native-community/netinfo';
import type { ConnectivityProvider } from './types';

export const isStateOnline = (state: NetInfoState | null): boolean => {
  if (!state) {
    return false;
  }
  if (state.isConnected !== true) {
    return false;
  }
  return state.isInternetReachable !== false;
};

export const createNetInfoConnectivity = (): ConnectivityProvider => ({
  async isOnline() {
    const state = await NetInfo.fetch();
    return isStateOnline(state);
  },

  subscribe(listener) {
    let previous: boolean | null = null;
    return NetInfo.addEventListener(state => {
      const online = isStateOnline(state);
      if (previous === online) {
        return;
      }
      previous = online;
      listener(online);
    });
  },
});

export const netInfoConnectivity = createNetInfoConnectivity();
