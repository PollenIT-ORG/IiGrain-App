import ImageCropPicker, {
  type Image as CropPickerImage,
  type Video as CropPickerVideo,
  type Options as CropPickerOptions,
} from 'react-native-image-crop-picker';

type RawMedia = CropPickerImage | CropPickerVideo;
import type {
  ImagePickerError,
  ImagePickerErrorCode,
  ImagePickerOptions,
  ImagePickerResult,
  ImagePickerSource,
  MediaFile,
} from '../types/media';
import {
  deriveFileName,
  getMimeType,
  isImage,
  isValidUri,
  mbToBytes,
  mediaTypeFromMime,
} from '../utils/imageHelpers';
import {
  isPermissionUsable,
  requestCameraPermission,
  requestGalleryPermission,
} from '../permissions/mediaPermissions';
import type { MediaPermissionStatus } from '../types/media';
import { presentationFor } from '../utils/resolveError';

const DEFAULTS = {
  multiple: false,
  maxSelection: 10,
  maxSizeMB: 10,
  crop: true,
  compressQuality: 0.75,
  mediaType: 'photo' as 'photo' | 'video' | 'any',
  allowedTypes: ['image/'],
  compressMaxEdge: 1600,
} as const;

const allowedTypesFor = (mediaType: 'photo' | 'video' | 'any'): string[] => {
  if (mediaType === 'video') {
    return ['video/'];
  }
  if (mediaType === 'any') {
    return ['image/', 'video/'];
  }
  return ['image/'];
};

let idCounter = 0;
const nextId = (): string => `media_${Date.now()}_${idCounter++}`;

const makeError = (
  code: ImagePickerErrorCode,
  message?: string,
): ImagePickerError => ({
  code,
  message: message ?? presentationFor(code).message,
});

const errorResult = (
  code: ImagePickerErrorCode,
  message?: string,
): ImagePickerResult => ({
  status: 'error',
  error: makeError(code, message ?? presentationFor(code).message),
});

const CANCEL_CODE = 'E_PICKER_CANCELLED';
const SIMULATOR_NO_CAMERA_CODE = 'E_PICKER_CANNOT_RUN_CAMERA_ON_SIMULATOR';
const PERMISSION_CODES = new Set([
  'E_NO_LIBRARY_PERMISSION',
  'E_NO_CAMERA_PERMISSION',
  'E_PERMISSION_MISSING',
]);

const readErrorCode = (error: unknown): string => {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : '';
  }
  return '';
};

const mapThrownError = (error: unknown): ImagePickerResult => {
  const code = readErrorCode(error);
  if (code === CANCEL_CODE) {
    return { status: 'cancelled' };
  }
  if (PERMISSION_CODES.has(code)) {
    return errorResult('PERMISSION_BLOCKED');
  }
  return errorResult('UNKNOWN');
};

const toMediaFile = (raw: RawMedia, source: ImagePickerSource): MediaFile => {
  const uri = raw.path;
  const mime = raw.mime || getMimeType(raw.filename ?? uri);
  const rawDuration = (raw as { duration?: number }).duration;
  return {
    id: nextId(),
    uri,
    name: raw.filename?.trim() || deriveFileName(uri, source),
    mime,
    size: typeof raw.size === 'number' ? raw.size : 0,
    width: typeof raw.width === 'number' ? raw.width : undefined,
    height: typeof raw.height === 'number' ? raw.height : undefined,
    durationMs: typeof rawDuration === 'number' ? rawDuration : undefined,
    type: mediaTypeFromMime(mime),
    source,
  };
};

const formatMB = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const validateFile = (
  file: MediaFile,
  maxSizeMB: number,
  allowedTypes: string[],
): ImagePickerError | null => {
  if (!isValidUri(file.uri)) {
    return makeError('INVALID_URI');
  }
  const typeOk = allowedTypes.some(
    t => file.mime === t || file.mime.startsWith(t) || (t === 'image/' && isImage(file.mime)),
  );
  if (!typeOk) {
    return makeError('UNSUPPORTED_TYPE');
  }
  if (file.size > mbToBytes(maxSizeMB)) {
    const noun = file.type === 'video' ? 'Videos' : 'Files';
    const actual = file.size > 0 ? ` (this one is ${formatMB(file.size)})` : '';
    return makeError(
      'FILE_TOO_LARGE',
      `${noun} can be up to ${maxSizeMB} MB${actual}. Please choose a smaller one.`,
    );
  }
  return null;
};

const resolveOptions = (options?: ImagePickerOptions) => {
  const mediaType = options?.mediaType ?? DEFAULTS.mediaType;
  return {
    multiple: options?.multiple ?? DEFAULTS.multiple,
    maxSelection: options?.maxSelection ?? DEFAULTS.maxSelection,
    maxSizeMB: options?.maxSizeMB ?? DEFAULTS.maxSizeMB,
    crop: options?.crop ?? DEFAULTS.crop,
    aspectRatio: options?.aspectRatio,
    compressQuality: options?.compressQuality ?? DEFAULTS.compressQuality,
    allowedTypes: options?.allowedTypes ?? allowedTypesFor(mediaType),
    mediaType,
  };
};

type ResolvedOptions = ReturnType<typeof resolveOptions>;

const buildCropPickerOptions = (
  resolved: ResolvedOptions,
  mediaType: 'photo' | 'video' | 'any',
): CropPickerOptions => {
  const isPhoto = mediaType === 'photo';
  const base: Record<string, unknown> = {
    mediaType,
    cropping: resolved.crop && isPhoto,
    compressImageQuality: resolved.compressQuality,
    compressImageMaxWidth: DEFAULTS.compressMaxEdge,
    compressImageMaxHeight: DEFAULTS.compressMaxEdge,
    forceJpg: isPhoto,
  };
  if (!isPhoto) {
    base.compressVideoPreset = 'MediumQuality';
  }
  if (resolved.crop && isPhoto) {
    if (resolved.aspectRatio) {
      const target = DEFAULTS.compressMaxEdge;
      const ratio = resolved.aspectRatio.width / resolved.aspectRatio.height;
      if (ratio >= 1) {
        base.width = target;
        base.height = Math.round(target / ratio);
      } else {
        base.height = target;
        base.width = Math.round(target * ratio);
      }
      base.freeStyleCropEnabled = false;
    } else {
      base.freeStyleCropEnabled = true;
    }
  }
  return base as CropPickerOptions;
};

const finalize = (
  raws: RawMedia[],
  source: ImagePickerSource,
  resolved: ResolvedOptions,
): ImagePickerResult => {
  const files: MediaFile[] = [];
  for (const raw of raws) {
    const file = toMediaFile(raw, source);
    const error = validateFile(file, resolved.maxSizeMB, resolved.allowedTypes);
    if (error) {
      for (const picked of raws) {
        ImageCropPicker.cleanSingle(picked.path).catch(() => undefined);
      }
      return { status: 'error', error };
    }
    files.push(file);
  }
  if (files.length === 0) {
    return { status: 'cancelled' };
  }
  return { status: 'success', files, source };
};

const permissionErrorResult = (status: MediaPermissionStatus): ImagePickerResult =>
  status === 'blocked'
    ? errorResult('PERMISSION_BLOCKED')
    : errorResult('PERMISSION_DENIED');

export const openCamera = async (options?: ImagePickerOptions): Promise<ImagePickerResult> => {
  const status = await requestCameraPermission();
  if (!isPermissionUsable(status)) {
    return permissionErrorResult(status);
  }
  const resolved = resolveOptions({ ...options, mediaType: 'photo' });
  try {
    const image = (await ImageCropPicker.openCamera(
      buildCropPickerOptions(resolved, 'photo'),
    )) as RawMedia;
    return finalize([image], 'camera', resolved);
  } catch (error) {
    if (__DEV__ && readErrorCode(error) === SIMULATOR_NO_CAMERA_CODE) {
      return pickImage({ ...options, mediaType: 'photo' });
    }
    return mapThrownError(error);
  }
};

export const recordVideo = async (options?: ImagePickerOptions): Promise<ImagePickerResult> => {
  const status = await requestCameraPermission(true);
  if (!isPermissionUsable(status)) {
    return permissionErrorResult(status);
  }
  const resolved = resolveOptions({ ...options, mediaType: 'video' });
  try {
    const video = (await ImageCropPicker.openCamera(
      buildCropPickerOptions(resolved, 'video'),
    )) as RawMedia;
    return finalize([video], 'camera', resolved);
  } catch (error) {
    if (__DEV__ && readErrorCode(error) === SIMULATOR_NO_CAMERA_CODE) {
      return pickImage({ ...options, mediaType: 'video' });
    }
    return mapThrownError(error);
  }
};

export const pickImage = async (options?: ImagePickerOptions): Promise<ImagePickerResult> => {
  const resolved = resolveOptions({ ...options, multiple: false });
  const status = await requestGalleryPermission(resolved.mediaType !== 'photo');
  if (!isPermissionUsable(status)) {
    return permissionErrorResult(status);
  }
  try {
    const result = (await ImageCropPicker.openPicker({
      ...buildCropPickerOptions(resolved, resolved.mediaType),
      multiple: false,
    })) as RawMedia | RawMedia[];
    const image = Array.isArray(result) ? result[0] : result;
    if (!image) {
      return { status: 'cancelled' };
    }
    return finalize([image], 'gallery', resolved);
  } catch (error) {
    return mapThrownError(error);
  }
};

export const pickMultipleImages = async (
  options?: ImagePickerOptions,
): Promise<ImagePickerResult> => {
  const resolved = resolveOptions({ ...options, multiple: true });
  const status = await requestGalleryPermission(resolved.mediaType !== 'photo');
  if (!isPermissionUsable(status)) {
    return permissionErrorResult(status);
  }
  try {
    const images = (await ImageCropPicker.openPicker({
      ...buildCropPickerOptions(resolved, resolved.mediaType),
      multiple: true,
      maxFiles: resolved.maxSelection,
    })) as RawMedia | RawMedia[];
    const list = Array.isArray(images) ? images : [images];
    if (list.length > resolved.maxSelection) {
      return errorResult(
        'LIMIT_EXCEEDED',
        `You can select up to ${resolved.maxSelection} files.`,
      );
    }
    return finalize(list, 'gallery', resolved);
  } catch (error) {
    return mapThrownError(error);
  }
};

export const cleanupTempFiles = async (): Promise<void> => {
  try {
    await ImageCropPicker.clean();
  } catch {
  }
};

export const imagePickerService = {
  openCamera,
  recordVideo,
  pickImage,
  pickMultipleImages,
  cleanupTempFiles,
};
