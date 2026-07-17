import { COLORS } from '../constants';
import type { FieldDocumentKind } from '../types/fieldDetails';

export type MediaType =
  | 'image'
  | 'video'
  | 'pdf'
  | 'word'
  | 'excel'
  | 'powerpoint'
  | 'file';

interface ClassifiableFile {
  kind: FieldDocumentKind;
  name: string;
  url: string;
}

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp'];
const VIDEO_EXT = ['mp4', 'mov', 'avi', 'mkv', 'm4v', 'webm', '3gp'];
const WORD_EXT = ['doc', 'docx'];
const EXCEL_EXT = ['xls', 'xlsx', 'csv'];
const PPT_EXT = ['ppt', 'pptx'];

export const getExtension = (source: string): string => {
  if (!source) {
    return '';
  }
  const clean = source.replace(/[?#].*$/, '');
  const base = clean.replace(/^.*[/\\]/, '');
  const dot = base.lastIndexOf('.');
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : '';
};

export interface MediaMeta {
  type: MediaType;
  icon: string;
  color: string;
  previewable: boolean;
  label: string;
}

const META: Record<MediaType, Omit<MediaMeta, 'type'>> = {
  image: { icon: 'file-image-outline', color: COLORS.primary, previewable: true, label: 'Image' },
  video: { icon: 'movie-open-outline', color: COLORS.gray900, previewable: true, label: 'Video' },
  pdf: { icon: 'file-pdf-box', color: COLORS.danger, previewable: false, label: 'PDF' },
  word: { icon: 'file-word-outline', color: COLORS.infoBlue, previewable: false, label: 'Word' },
  excel: { icon: 'file-excel-outline', color: COLORS.success, previewable: false, label: 'Excel' },
  powerpoint: {
    icon: 'file-powerpoint-outline',
    color: COLORS.accent,
    previewable: false,
    label: 'PowerPoint',
  },
  file: { icon: 'file-document-outline', color: COLORS.gray600, previewable: false, label: 'File' },
};

const resolveType = (kind: FieldDocumentKind, ext: string): MediaType => {
  if (kind === 'image' || IMAGE_EXT.includes(ext)) {
    return 'image';
  }
  if (kind === 'video' || VIDEO_EXT.includes(ext)) {
    return 'video';
  }
  if (kind === 'pdf' || ext === 'pdf') {
    return 'pdf';
  }
  if (WORD_EXT.includes(ext)) {
    return 'word';
  }
  if (EXCEL_EXT.includes(ext)) {
    return 'excel';
  }
  if (PPT_EXT.includes(ext)) {
    return 'powerpoint';
  }
  return 'file';
};

export const classifyMedia = (doc: ClassifiableFile): MediaMeta => {
  const ext = getExtension(doc.url) || getExtension(doc.name);
  const type = resolveType(doc.kind, ext);
  return { type, ...META[type] };
};
