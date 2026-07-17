import type { MediaFile, MediaType } from '../types/media';

export const BYTES_PER_MB = 1024 * 1024;

export const mbToBytes = (mb: number): number => Math.round(mb * BYTES_PER_MB);

export const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, exponent);
  const formatted = exponent === 0 ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
  return `${formatted} ${units[exponent]}`;
};

export const getExtension = (input: string): string => {
  if (!input) {
    return '';
  }
  const clean = input.split('?')[0].split('#')[0];
  const lastSlash = clean.lastIndexOf('/');
  const name = lastSlash >= 0 ? clean.slice(lastSlash + 1) : clean;
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
};

export const isImage = (mime: string | undefined | null): boolean =>
  typeof mime === 'string' && mime.toLowerCase().startsWith('image/');

export const mediaTypeFromMime = (mime: string | undefined | null): MediaType =>
  typeof mime === 'string' && mime.toLowerCase().startsWith('video/') ? 'video' : 'image';

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  gif: 'image/gif',
  bmp: 'image/bmp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
};

export const getMimeType = (input: string, fallback = 'image/jpeg'): string =>
  EXT_TO_MIME[getExtension(input)] ?? fallback;

export const isValidUri = (uri: string | undefined | null): boolean => {
  if (typeof uri !== 'string' || uri.trim().length === 0) {
    return false;
  }
  return /^(file:|content:|assets-library:|ph:|https?:|\/)/i.test(uri.trim());
};

export const deriveFileName = (uri: string, source: 'camera' | 'gallery'): string => {
  const ext = getExtension(uri) || 'jpg';
  const last = uri.split('?')[0].split('/').pop() ?? '';
  if (last && last.includes('.')) {
    return last;
  }
  return `${source}_image.${ext}`;
};

export const mediaFilesFromUrls = (urls: string[]): MediaFile[] =>
  urls.map((url, index) => {
    const mime = getMimeType(url);
    return {
      id: `remote-${index}-${url}`,
      uri: url,
      name: deriveFileName(url, 'gallery'),
      mime,
      size: 0,
      type: mediaTypeFromMime(mime),
      source: 'gallery',
    };
  });
