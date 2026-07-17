import * as Keychain from 'react-native-keychain';
import {
  KEYCHAIN_TOKEN_ACCOUNT,
  KEYCHAIN_TOKEN_SERVICE,
  KEYCHAIN_REFRESH_ACCOUNT,
  KEYCHAIN_REFRESH_SERVICE,
} from '../config/storageKeys';

let inMemoryAccess: string | null = null;
let inMemoryRefresh: string | null = null;
let accessLoaded = false;
let refreshLoaded = false;

const accessOptions = { service: KEYCHAIN_TOKEN_SERVICE } as const;
const refreshOptions = { service: KEYCHAIN_REFRESH_SERVICE } as const;

export const tokenStorage = {
  async get(): Promise<string | null> {
    if (accessLoaded) {
      return inMemoryAccess;
    }
    try {
      const credentials = await Keychain.getGenericPassword(accessOptions);
      inMemoryAccess = credentials ? credentials.password : null;
    } catch {
      inMemoryAccess = null;
    } finally {
      accessLoaded = true;
    }
    return inMemoryAccess;
  },

  async getRefresh(): Promise<string | null> {
    if (refreshLoaded) {
      return inMemoryRefresh;
    }
    try {
      const credentials = await Keychain.getGenericPassword(refreshOptions);
      inMemoryRefresh = credentials ? credentials.password : null;
    } catch {
      inMemoryRefresh = null;
    } finally {
      refreshLoaded = true;
    }
    return inMemoryRefresh;
  },

  async save(token: string, refreshToken?: string): Promise<void> {
    inMemoryAccess = token;
    accessLoaded = true;
    await Keychain.setGenericPassword(KEYCHAIN_TOKEN_ACCOUNT, token, accessOptions);

    if (refreshToken !== undefined) {
      inMemoryRefresh = refreshToken;
      refreshLoaded = true;
      await Keychain.setGenericPassword(
        KEYCHAIN_REFRESH_ACCOUNT,
        refreshToken,
        refreshOptions,
      );
    }
  },

  async clear(): Promise<void> {
    inMemoryAccess = null;
    inMemoryRefresh = null;
    accessLoaded = true;
    refreshLoaded = true;
    await Keychain.resetGenericPassword(accessOptions);
    await Keychain.resetGenericPassword(refreshOptions);
  },

  peek(): string | null {
    return inMemoryAccess;
  },
};
