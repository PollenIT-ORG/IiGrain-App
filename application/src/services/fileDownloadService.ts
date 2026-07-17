import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { getExtension } from '../utils/fileType';

interface DownloadableDoc {
  id: string;
  name: string;
  url: string;
}

export type DownloadProgress = (fraction: number) => void;

const BASE_DIR =
  Platform.OS === 'ios' ? RNFS.DocumentDirectoryPath : RNFS.ExternalDirectoryPath;
const DOWNLOAD_DIR = `${BASE_DIR}/iiGrain`;

const sanitize = (name: string): string =>
  name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'file';

export const getLocalPath = (doc: DownloadableDoc): string => {
  const ext = getExtension(doc.url) || getExtension(doc.name);
  const base = sanitize(doc.name.replace(/\.[^.]+$/, ''));
  const suffix = ext ? `.${ext}` : '';
  return `${DOWNLOAD_DIR}/${doc.id}__${base}${suffix}`;
};

export const toFileUri = (path: string): string =>
  path.startsWith('file://') ? path : `file://${path}`;

export const isDownloaded = (doc: DownloadableDoc): Promise<boolean> =>
  RNFS.exists(getLocalPath(doc));

const ensureDir = async (): Promise<void> => {
  const exists = await RNFS.exists(DOWNLOAD_DIR);
  if (!exists) {
    await RNFS.mkdir(DOWNLOAD_DIR);
  }
};

export const downloadDocument = async (
  doc: DownloadableDoc,
  onProgress?: DownloadProgress,
): Promise<string> => {
  const toFile = getLocalPath(doc);
  if (await RNFS.exists(toFile)) {
    onProgress?.(1);
    return toFile;
  }
  await ensureDir();
  const { promise } = RNFS.downloadFile({
    fromUrl: doc.url,
    toFile,
    progressInterval: 150,
    progress: res => {
      if (res.contentLength > 0) {
        onProgress?.(Math.min(1, res.bytesWritten / res.contentLength));
      }
    },
  });
  const result = await promise;
  if (result.statusCode < 200 || result.statusCode >= 300) {
    await RNFS.unlink(toFile).catch(() => undefined);
    throw new Error(`Download failed (HTTP ${result.statusCode})`);
  }
  return toFile;
};
