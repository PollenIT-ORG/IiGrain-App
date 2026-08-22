import { Linking } from 'react-native';
import { showToast } from '../services/toastService';

const WEB_URL = /^https?:\/\/\S+$/i;

export const isOpenableUrl = (url: string | null | undefined): url is string =>
  typeof url === 'string' && WEB_URL.test(url.trim());

export const openExternalUrl = async (
  url: string | null | undefined,
  failureMessage = "We couldn't open that link. Please try again.",
): Promise<boolean> => {
  if (!isOpenableUrl(url)) {
    showToast(failureMessage, { type: 'error' });
    return false;
  }
  try {
    await Linking.openURL(url.trim());
    return true;
  } catch {
    showToast(failureMessage, { type: 'error' });
    return false;
  }
};
