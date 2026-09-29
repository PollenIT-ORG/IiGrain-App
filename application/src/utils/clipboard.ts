import { Share } from 'react-native';

interface ClipboardModule {
  setString: (text: string) => void;
}

export type CopyOutcome = 'copied' | 'shared' | 'failed';

const loadClipboard = (): ClipboardModule | null => {
  try {
    const mod = require('@react-native-clipboard/clipboard');
    return (mod?.default ?? mod) as ClipboardModule;
  } catch {
    return null;
  }
};

const writeToClipboard = (text: string): boolean => {
  const clipboard = loadClipboard();
  if (!clipboard || typeof clipboard.setString !== 'function') {
    return false;
  }
  try {
    clipboard.setString(text);
    return true;
  } catch {
    return false;
  }
};

export const copyText = async (text: string): Promise<CopyOutcome> => {
  if (writeToClipboard(text)) {
    return 'copied';
  }
  try {
    await Share.share({ message: text });
    return 'shared';
  } catch {
    return 'failed';
  }
};
