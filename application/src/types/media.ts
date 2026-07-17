export type MediaType = 'image' | 'video';

export type ImagePickerSource = 'camera' | 'gallery';

export interface MediaFile {
  id: string;
  uri: string;
  name: string;
  mime: string;
  size: number;
  width?: number;
  height?: number;
  durationMs?: number;
  type: MediaType;
  source: ImagePickerSource;
}

export interface AspectRatio {
  width: number;
  height: number;
}

export interface ImagePickerOptions {
  multiple?: boolean;
  maxSelection?: number;
  maxSizeMB?: number;
  crop?: boolean;
  aspectRatio?: AspectRatio;
  compressQuality?: number;
  allowedTypes?: string[];
  mediaType?: 'photo' | 'video' | 'any';
}

export type ImagePickerErrorCode =
  | 'CANCELLED'
  | 'PERMISSION_DENIED'
  | 'PERMISSION_BLOCKED'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_TYPE'
  | 'INVALID_URI'
  | 'LIMIT_EXCEEDED'
  | 'UNKNOWN';

export interface ImagePickerError {
  code: ImagePickerErrorCode;
  message: string;
}

export type ImagePickerResult =
  | { status: 'success'; files: MediaFile[]; source: ImagePickerSource }
  | { status: 'cancelled' }
  | { status: 'error'; error: ImagePickerError };

export type MediaPermissionType = 'camera' | 'gallery';

export type MediaPermissionStatus =
  | 'granted'
  | 'limited'
  | 'denied'
  | 'blocked'
  | 'unavailable';
