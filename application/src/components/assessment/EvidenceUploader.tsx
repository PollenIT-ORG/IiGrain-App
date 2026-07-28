import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import AppImageViewer from '../AppImageViewer/AppImageViewer';
import AppVideoViewer from '../AppVideoViewer/AppVideoViewer';
import { AppIcon, ICONS } from '../AppIcon';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  spacing,
} from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';
import { getMimeType, mbToBytes, mediaTypeFromMime } from '../../utils/imageHelpers';
import AppText from '../AppText/AppText';
import ImagePickerBottomSheet, {
  type SheetAction,
} from '../AppImagePicker/ImagePickerBottomSheet';
import { imagePickerService } from '../../services/imagePickerService';
import { pickDocument, type PickedDocument } from '../../services/documentPickerService';
import { openAppSettings } from '../../permissions/mediaPermissions';
import { showToast } from '../../services/toastService';
import type { ImagePickerResult, MediaFile } from '../../types/media';

export type EvidenceKind = 'image' | 'video' | 'pdf';

export interface EvidenceMedia {
  uri: string;
  name: string;
  mime: string;
  size: number;
  kind: EvidenceKind;
  durationMs?: number;
}

export type EvidenceUploadFn = (
  file: EvidenceMedia,
  onProgress: (fraction: number) => void,
) => Promise<string>;

export interface EvidenceUploaderProps {
  initialUrls: string[];
  onChange: (urls: string[], uploading: boolean) => void;
  upload: EvidenceUploadFn;
  disabled?: boolean;
  maxSelection?: number;
  maxSizeMB?: number;
}

type ItemStatus = 'done' | 'uploading' | 'error';

interface EvidenceItem {
  id: string;
  kind: EvidenceKind;
  name: string;
  media?: EvidenceMedia;
  url: string | null;
  durationMs?: number;
  status: ItemStatus;
  progress: number;
}

let seq = 0;
const nextId = (): string => `ev_${Date.now()}_${seq++}`;

const kindFromUrl = (url: string): EvidenceKind => {
  if (/\.pdf($|\?)/i.test(url)) {
    return 'pdf';
  }
  if (/\/video\//i.test(url)) {
    return 'video';
  }
  return mediaTypeFromMime(getMimeType(url));
};

const fileNameFromUrl = (url: string): string => {
  const last = url.split('?')[0].split('/').pop();
  return last && last.length > 0 ? last : 'evidence';
};

const seedFromUrls = (urls: string[]): EvidenceItem[] =>
  urls.map((url, i) => ({
    id: `remote-${i}-${url}`,
    kind: kindFromUrl(url),
    name: fileNameFromUrl(url),
    url,
    status: 'done',
    progress: 1,
  }));

const mediaFileToEvidence = (file: MediaFile): EvidenceMedia => ({
  uri: file.uri,
  name: file.name,
  mime: file.mime,
  size: file.size,
  kind: file.type,
  durationMs: file.durationMs,
});

const validatePdf = (doc: PickedDocument, maxBytes: number): string | null => {
  const isPdf = doc.mime === 'application/pdf' || /\.pdf$/i.test(doc.name);
  if (!isPdf) {
    return 'Only PDF documents are supported.';
  }
  if (doc.size !== null && doc.size > maxBytes) {
    return 'The file is too large. Please choose a smaller one.';
  }
  return null;
};

const formatDuration = (ms: number): string => {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const EvidenceTile: React.FC<{
  item: EvidenceItem;
  disabled: boolean;
  onRemove: (id: string) => void;
  onRetry: (item: EvidenceItem) => void;
  onPreview: (item: EvidenceItem) => void;
  onPlayVideo: (item: EvidenceItem) => void;
}> = ({ item, disabled, onRemove, onRetry, onPreview, onPlayVideo }) => {
  const previewUri = item.url ?? item.media?.uri;

  return (
    <View style={styles.tile}>
      {item.kind === 'image' && previewUri ? (
        <Pressable
          style={styles.thumb}
          onPress={() => onPreview(item)}
          accessibilityRole="imagebutton"
          accessibilityLabel="View image">
          <Image source={{ uri: previewUri }} style={styles.thumb} resizeMode="cover" />
        </Pressable>
      ) : item.kind === 'pdf' ? (
        <View style={styles.docTile}>
          <AppIcon name={ICONS.PDF} size={moderateScale(28)} color={COLORS.danger} />
          <AppText style={styles.docName} numberOfLines={2}>
            {item.name}
          </AppText>
        </View>
      ) : (
        <Pressable
          style={styles.videoTile}
          onPress={() => onPlayVideo(item)}
          accessibilityRole="button"
          accessibilityLabel="Play video">
          <AppIcon name={ICONS.VIDEO_FILE} size={moderateScale(26)} color={COLORS.primary} />
        </Pressable>
      )}

      {item.status === 'uploading' ? (
        <View style={styles.overlay}>
          <AppText style={styles.progressPct}>
            {Math.round(item.progress * 100)}%
          </AppText>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${Math.round(item.progress * 100)}%` }]}
            />
          </View>
        </View>
      ) : null}

      {item.status === 'error' ? (
        <Pressable style={styles.errorOverlay} onPress={() => onRetry(item)}>
          <AppIcon name={ICONS.RETRY} size={moderateScale(20)} color={COLORS.white} />
          <AppText style={styles.retryText}>Retry</AppText>
        </Pressable>
      ) : null}

      {item.kind === 'video' && item.status === 'done' ? (
        <>
          <View style={styles.playBadge} pointerEvents="none">
            <AppIcon name={ICONS.PLAY} size={moderateScale(12)} color={COLORS.white} />
          </View>
          {item.durationMs ? (
            <View style={styles.durationBadge} pointerEvents="none">
              <AppText style={styles.durationText}>{formatDuration(item.durationMs)}</AppText>
            </View>
          ) : null}
        </>
      ) : null}

      {!disabled && item.status !== 'uploading' ? (
        <Pressable
          style={styles.removeBtn}
          onPress={() => onRemove(item.id)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Remove evidence">
          <AppIcon name={ICONS.CLOSE} size={moderateScale(13)} color={COLORS.white} />
        </Pressable>
      ) : null}
    </View>
  );
};

const EvidenceUploader: React.FC<EvidenceUploaderProps> = ({
  initialUrls,
  onChange,
  upload,
  disabled = false,
  maxSelection = 5,
  maxSizeMB = 50,
}) => {
  const [items, setItems] = useState<EvidenceItem[]>(() => seedFromUrls(initialUrls));
  const [sheetVisible, setSheetVisible] = useState(false);

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const imageItems = useMemo(
    () => items.filter(it => it.kind === 'image' && (it.url ?? it.media?.uri)),
    [items],
  );
  const viewerImages = useMemo(
    () => imageItems.map(it => ({ uri: (it.url ?? it.media?.uri) as string })),
    [imageItems],
  );
  const openPreview = useCallback(
    (item: EvidenceItem) => {
      const idx = imageItems.findIndex(it => it.id === item.id);
      if (idx >= 0) {
        setViewerIndex(idx);
        setViewerVisible(true);
      }
    },
    [imageItems],
  );

  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoVisible, setVideoVisible] = useState(false);
  const openVideo = useCallback((item: EvidenceItem) => {
    const uri = item.url ?? item.media?.uri ?? null;
    if (uri) {
      setVideoUri(uri);
      setVideoVisible(true);
    }
  }, []);

  const uploadRef = useRef(upload);
  uploadRef.current = upload;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const urls = items
      .filter(it => it.status === 'done' && it.url)
      .map(it => it.url as string);
    const uploading = items.some(it => it.status === 'uploading');
    onChangeRef.current(urls, uploading);
  }, [items]);

  const patch = useCallback((id: string, changes: Partial<EvidenceItem>) => {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...changes } : it)));
  }, []);

  const startUpload = useCallback(
    (item: EvidenceItem) => {
      if (!item.media) {
        return;
      }
      patch(item.id, { status: 'uploading', progress: 0 });
      uploadRef.current(item.media, fraction => patch(item.id, { progress: fraction }))
        .then(url => patch(item.id, { status: 'done', url, progress: 1 }))
        .catch(() => patch(item.id, { status: 'error' }));
    },
    [patch],
  );

  const remaining = Math.max(maxSelection - items.length, 0);

  const addEvidence = useCallback(
    (medias: EvidenceMedia[]) => {
      const fresh: EvidenceItem[] = medias.slice(0, remaining).map(media => ({
        id: nextId(),
        kind: media.kind,
        name: media.name,
        media,
        url: null,
        durationMs: media.durationMs,
        status: 'uploading',
        progress: 0,
      }));
      if (fresh.length === 0) {
        return;
      }
      setItems(prev => [...prev, ...fresh]);
      fresh.forEach(startUpload);
    },
    [remaining, startUpload],
  );

  const handlePickResult = useCallback(
    (result: ImagePickerResult) => {
      if (result.status === 'cancelled') {
        return;
      }
      if (result.status === 'error') {
        if (result.error.code === 'PERMISSION_BLOCKED') {
          openAppSettings();
        }
        showToast(result.error.message, { type: 'error' });
        return;
      }
      addEvidence(result.files.map(mediaFileToEvidence));
    },
    [addEvidence],
  );

  /**
   * A ref, not state: two taps in the same tick would both read a stale
   * `false` from state and open two native pickers, which iOS rejects the same
   * way a picker over a live modal is rejected.
   */
  const pickBusy = useRef(false);

  const runPick = useCallback(
    async (fn: () => Promise<ImagePickerResult>) => {
      if (pickBusy.current) {
        return;
      }
      pickBusy.current = true;
      try {
        handlePickResult(await fn());
      } finally {
        pickBusy.current = false;
      }
    },
    [handlePickResult],
  );

  const choosePdf = useCallback(async () => {
    if (pickBusy.current) {
      return;
    }
    pickBusy.current = true;
    let doc: PickedDocument | null;
    try {
      doc = await pickDocument({ pdfOnly: true });
    } catch {
      showToast('Could not open the file picker.', { type: 'error' });
      return;
    } finally {
      pickBusy.current = false;
    }
    if (!doc) {
      return;
    }
    const problem = validatePdf(doc, mbToBytes(maxSizeMB));
    if (problem) {
      showToast(problem, { type: 'error' });
      return;
    }
    addEvidence([
      { uri: doc.uri, name: doc.name, mime: doc.mime, size: doc.size ?? 0, kind: 'pdf' },
    ]);
  }, [addEvidence, maxSizeMB]);

  const handleRemove = useCallback(
    (id: string) => setItems(prev => prev.filter(it => it.id !== id)),
    [],
  );

  const openSheet = useCallback(() => {
    if (disabled || remaining <= 0) {
      return;
    }
    setSheetVisible(true);
  }, [disabled, remaining]);

  const sheetActions: SheetAction[] = [
    {
      key: 'take-photo',
      icon: 'camera-outline',
      label: 'Take Photo',
      onPress: () => runPick(() => imagePickerService.openCamera({ maxSizeMB, crop: false })),
    },
    {
      key: 'record-video',
      icon: 'video-outline',
      label: 'Record Video',
      onPress: () => runPick(() => imagePickerService.recordVideo({ maxSizeMB })),
    },
    {
      key: 'choose-photo',
      icon: 'image-outline',
      label: 'Choose Photo',
      onPress: () =>
        runPick(() =>
          imagePickerService.pickMultipleImages({
            multiple: true,
            maxSelection: remaining,
            maxSizeMB,
            crop: false,
            mediaType: 'photo',
          }),
        ),
    },
    {
      key: 'choose-video',
      icon: 'file-video-outline',
      label: 'Choose Video',
      onPress: () =>
        runPick(() =>
          imagePickerService.pickMultipleImages({
            multiple: true,
            maxSelection: remaining,
            maxSizeMB,
            crop: false,
            mediaType: 'video',
          }),
        ),
    },
    {
      key: 'choose-pdf',
      icon: 'file-pdf-box',
      label: 'Choose PDF',
      onPress: choosePdf,
    },
  ];

  if (disabled && items.length === 0) {
    return <AppText style={styles.emptyText}>No evidence was attached.</AppText>;
  }

  return (
    <View>
      <View style={styles.grid}>
        {items.map(item => (
          <EvidenceTile
            key={item.id}
            item={item}
            disabled={disabled}
            onRemove={handleRemove}
            onRetry={startUpload}
            onPreview={openPreview}
            onPlayVideo={openVideo}
          />
        ))}

        {!disabled && remaining > 0 ? (
          <Pressable
            style={styles.addTile}
            onPress={openSheet}
            accessibilityRole="button"
            accessibilityLabel="Add evidence">
            <AppIcon name={ICONS.PLUS} size={moderateScale(24)} color={COLORS.gray500} />
            <AppText style={styles.addLabel}>Photo / Video / PDF</AppText>
          </Pressable>
        ) : null}
      </View>

      <ImagePickerBottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        actions={sheetActions}
        title="Add Evidence"
      />

      {viewerImages.length > 0 ? (
        <AppImageViewer
          images={viewerImages}
          imageIndex={Math.min(viewerIndex, viewerImages.length - 1)}
          visible={viewerVisible}
          onRequestClose={() => setViewerVisible(false)}
        />
      ) : null}

      <AppVideoViewer
        uri={videoUri}
        visible={videoVisible}
        onRequestClose={() => setVideoVisible(false)}
      />
    </View>
  );
};

export default React.memo(EvidenceUploader);

const TILE = scale(84);

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: COLORS.gray100,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  videoTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    borderRadius: borderRadius.md,
    backgroundColor: COLORS.lightPrimary,
  },
  docTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[1.5],
    gap: spacing[1],
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    borderRadius: borderRadius.md,
    backgroundColor: COLORS.white,
  },
  docName: {
    ...presets.caption,
    fontSize: 9,
    color: COLORS.gray700,
    textAlign: 'center',
  },
  playBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -scale(13),
    marginLeft: -scale(13),
    width: scale(26),
    height: scale(26),
    borderRadius: borderRadius.full,
    backgroundColor: addAlpha(COLORS.black, 0.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: spacing[1],
    left: spacing[1],
    paddingHorizontal: spacing[1.5],
    paddingVertical: scale(1),
    borderRadius: borderRadius.sm,
    backgroundColor: addAlpha(COLORS.black, 0.6),
  },
  durationText: {
    ...presets.caption,
    fontSize: 9,
    color: COLORS.white,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: addAlpha(COLORS.black, 0.45),
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[2],
  },
  progressPct: {
    ...presets.labelSM,
    color: COLORS.white,
  },
  progressTrack: {
    width: '80%',
    height: scale(5),
    borderRadius: borderRadius.full,
    backgroundColor: addAlpha(COLORS.white, 0.35),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.white,
  },

  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: addAlpha(COLORS.danger, 0.55),
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
  },
  retryText: {
    ...presets.caption,
    color: COLORS.white,
  },

  removeBtn: {
    position: 'absolute',
    top: spacing[1],
    right: spacing[1],
    width: scale(20),
    height: scale(20),
    borderRadius: borderRadius.full,
    backgroundColor: addAlpha(COLORS.black, 0.55),
    alignItems: 'center',
    justifyContent: 'center',
  },

  addTile: {
    width: TILE,
    height: TILE,
    borderRadius: borderRadius.md,
    borderWidth: borderWidth.medium,
    borderColor: COLORS.gray300,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    backgroundColor: COLORS.gray100,
  },
  addLabel: {
    ...presets.caption,
    fontSize: 9,
    color: COLORS.gray600,
    textAlign: 'center',
  },
  emptyText: {
    ...presets.bodySM,
    color: COLORS.gray500,
  },
});
