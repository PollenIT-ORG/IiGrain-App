import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import AppText from '../AppText/AppText';
import Button from '../Button/Button';
import ConfirmationModal from '../modals/ConfirmationModal';
import AppImageViewer from '../AppImageViewer/AppImageViewer';
import AppVideoViewer from '../AppVideoViewer/AppVideoViewer';
import { AttachmentCard } from '../media';
import { COLORS, borderRadius, borderWidth, presets, spacing } from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';
import { classifyMedia } from '../../utils/fileType';
import { useFileDownloads } from '../../hooks/useFileDownloads';
import { toFileUri } from '../../services/fileDownloadService';
import { showSuccess, showToast } from '../../services/toastService';
import type { MonitoringDocument } from '../../types/monitoring';

export type PendingAttachmentStatus =
  | 'queued'
  | 'waiting'
  | 'uploading'
  | 'failed';

export interface PendingAttachment {
  id: string;
  name: string;
  sizeBytes?: number | null;
  status: PendingAttachmentStatus;
}

export interface MonitoringAttachmentsProps {
  title: string;
  subtitle?: string;
  documents: MonitoringDocument[];
  loading: boolean;
  error: string | null;
  uploading: boolean;
  deletingId: string | null;
  emptyMessage: string;
  onAdd: () => void;
  onDelete: (documentId: string) => void;
  onRetry: () => void;
  disabledNote?: string;
  addLabel?: string;
  pending?: readonly PendingAttachment[];
  onRemovePending?: (id: string) => void;
}

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

const EMPTY_PENDING: readonly PendingAttachment[] = [];

const KB = 1024;
const MB = KB * 1024;

const sizeLabel = (bytes?: number | null): string => {
  if (typeof bytes !== 'number' || bytes <= 0) {
    return '';
  }
  return bytes >= MB
    ? `${(bytes / MB).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / KB))} KB`;
};

interface PendingLook {
  readonly text: string;
  readonly accent: string;
  readonly badge: string | null;
  readonly dashed: boolean;
}

export const PENDING_LOOK: Record<PendingAttachmentStatus, PendingLook> = {
  queued: {
    text: 'Attaches when you save',
    accent: COLORS.gray600,
    badge: null,
    dashed: true,
  },
  waiting: {
    text: 'Kept on this device · uploads later',
    accent: COLORS.infoBlue,
    badge: ICONS.CLOUD_OFFLINE,
    dashed: false,
  },
  uploading: {
    text: 'Uploading…',
    accent: COLORS.primary,
    badge: null,
    dashed: false,
  },
  failed: {
    text: 'Could not upload · still on this device',
    accent: COLORS.danger,
    badge: ICONS.CLOUD_ALERT,
    dashed: false,
  },
};

interface PendingRowProps {
  item: PendingAttachment;
  onRemove?: (id: string) => void;
}

const PendingRow: React.FC<PendingRowProps> = ({ item, onRemove }) => {
  const meta = classifyMedia({
    kind: 'file',
    name: item.name,
    url: item.name,
  });
  const look = PENDING_LOOK[item.status];
  const size = sizeLabel(item.sizeBytes);

  return (
    <View
      style={[
        styles.pending,
        look.dashed
          ? styles.pendingDashed
          : {
              borderColor: addAlpha(look.accent, 0.3),
              backgroundColor: addAlpha(look.accent, 0.06),
            },
      ]}>
      <View style={styles.pendingIcon}>
        {item.status === 'uploading' ? (
          <ActivityIndicator size="small" color={look.accent} />
        ) : (
          <AppIcon name={meta.icon} size={moderateScale(20)} color={meta.color} />
        )}
        {look.badge ? (
          <View style={[styles.pendingBadge, { backgroundColor: look.accent }]}>
            <AppIcon name={look.badge} size={moderateScale(10)} color={COLORS.white} />
          </View>
        ) : null}
      </View>

      <View style={styles.pendingTexts}>
        <AppText style={styles.pendingName} numberOfLines={1}>
          {item.name}
        </AppText>
        <AppText style={[styles.pendingMeta, { color: look.accent }]} numberOfLines={2}>
          {size ? `${size} · ${look.text}` : look.text}
        </AppText>
      </View>

      {onRemove && item.status !== 'uploading' ? (
        <TouchableOpacity
          onPress={() => onRemove(item.id)}
          hitSlop={HIT_SLOP}
          style={styles.pendingRemove}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.name}`}>
          <AppIcon name={ICONS.CLOSE} size={moderateScale(16)} color={COLORS.gray600} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const MonitoringAttachments: React.FC<MonitoringAttachmentsProps> = ({
  title,
  subtitle,
  documents,
  loading,
  error,
  uploading,
  deletingId,
  emptyMessage,
  onAdd,
  onDelete,
  onRetry,
  disabledNote,
  addLabel,
  pending,
  onRemovePending,
}) => {
  const { entries, download } = useFileDownloads(documents);

  const pendingList = pending ?? EMPTY_PENDING;
  const empty = documents.length === 0 && pendingList.length === 0;
  const total = documents.length + pendingList.length;

  const imageDocs = useMemo(
    () => documents.filter(d => classifyMedia(d).type === 'image'),
    [documents],
  );

  const viewerImages = useMemo(
    () =>
      imageDocs.map(doc => {
        const entry = entries[doc.id];
        const uri =
          entry?.status === 'exists' && entry.localPath ? toFileUri(entry.localPath) : doc.url;
        return { uri };
      }),
    [imageDocs, entries],
  );

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MonitoringDocument | null>(null);

  const openDocument = useCallback(
    (doc: MonitoringDocument, previewUri: string) => {
      const type = classifyMedia(doc).type;
      if (type === 'image') {
        const index = imageDocs.findIndex(d => d.id === doc.id);
        if (index >= 0) {
          setViewerIndex(index);
          setViewerVisible(true);
          return;
        }
      }
      if (type === 'video') {
        setVideoUri(previewUri);
        return;
      }
      Linking.openURL(doc.url).catch(() =>
        showToast('Could not open this file.', { type: 'error' }),
      );
    },
    [imageDocs],
  );

  const handleDownload = useCallback(
    async (doc: MonitoringDocument) => {
      const ok = await download(doc);
      if (ok) {
        showSuccess('Saved to your device');
      } else {
        showToast('Download failed. Please try again.', { type: 'error' });
      }
    },
    [download],
  );

  const handleShare = useCallback(async (doc: MonitoringDocument) => {
    try {
      await Share.share({
        message: `${doc.name}\n${doc.url}`,
        url: doc.url,
        title: doc.name,
      });
    } catch {
      showToast('Could not share this file.', { type: 'error' });
    }
  }, []);

  const confirmDelete = useCallback(() => {
    if (pendingDelete) {
      onDelete(pendingDelete.id);
      setPendingDelete(null);
    }
  }, [pendingDelete, onDelete]);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <AppIcon name={ICONS.EVIDENCE} size={moderateScale(16)} color={COLORS.primary} />
        </View>
        <View style={styles.headerTexts}>
          <AppText style={styles.title}>{title}</AppText>
          {subtitle ? <AppText style={styles.subtitle}>{subtitle}</AppText> : null}
        </View>
        {total > 0 ? (
          <View style={styles.countChip}>
            <AppText style={styles.countText}>{total}</AppText>
          </View>
        ) : null}
      </View>

      {disabledNote ? (
        <View style={styles.note}>
          <AppIcon name={ICONS.INFO} size={moderateScale(16)} color={COLORS.gray600} />
          <AppText style={styles.noteText}>{disabledNote}</AppText>
        </View>
      ) : (
        <Button
          title={addLabel ?? 'Attach a file'}
          variant="outline"
          loading={uploading}
          onPress={onAdd}
          leftIcon={<AppIcon name={ICONS.UPLOAD} size={moderateScale(18)} color={COLORS.primary} />}
        />
      )}

      {loading && empty ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      ) : error && empty ? (
        <View style={styles.centered}>
          <AppText style={styles.errorText}>{error}</AppText>
          <TouchableOpacity onPress={onRetry} hitSlop={HIT_SLOP} accessibilityRole="button">
            <AppText style={styles.retryText}>Retry</AppText>
          </TouchableOpacity>
        </View>
      ) : empty ? (
        <View style={styles.empty}>
          <AppIcon name="file-outline" size={moderateScale(22)} color={COLORS.gray500} />
          <AppText style={styles.emptyText}>{emptyMessage}</AppText>
        </View>
      ) : (
        <View style={styles.list}>
          {pendingList.map(item => (
            <PendingRow key={item.id} item={item} onRemove={onRemovePending} />
          ))}
          {documents.map(doc => (
            <AttachmentCard
              key={doc.id}
              doc={doc}
              entry={entries[doc.id]}
              deleting={deletingId === doc.id}
              onPreview={(d, uri) => openDocument(d as MonitoringDocument, uri)}
              onDownload={d => handleDownload(d as MonitoringDocument)}
              onDelete={d => setPendingDelete(d as MonitoringDocument)}
              onShare={d => handleShare(d as MonitoringDocument)}
            />
          ))}
        </View>
      )}

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
        visible={videoUri !== null}
        onRequestClose={() => setVideoUri(null)}
      />

      <ConfirmationModal
        visible={pendingDelete !== null}
        tone="danger"
        icon={ICONS.DELETE}
        title="Remove this file?"
        message={
          pendingDelete
            ? `"${pendingDelete.name}" will be removed from this record. This cannot be undone.`
            : ''
        }
        confirmLabel="Remove"
        loading={deletingId !== null}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </View>
  );
};

export default React.memo(MonitoringAttachments);

const styles = StyleSheet.create({
  section: {
    gap: spacing[3],
    backgroundColor: COLORS.white,
    borderRadius: borderRadius['2xl'],
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
  },
  headerIcon: {
    width: scale(30),
    height: scale(30),
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.lightPrimary,
  },
  headerTexts: {
    flex: 1,
    gap: scale(2),
  },
  title: {
    ...presets.labelLG,
    color: COLORS.gray900,
  },
  subtitle: {
    ...presets.bodyXS,
    color: COLORS.gray600,
  },
  countChip: {
    minWidth: scale(26),
    paddingHorizontal: spacing[2],
    paddingVertical: scale(2),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.lightPrimary,
    alignItems: 'center',
  },
  countText: {
    ...presets.labelSM,
    color: COLORS.primary,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    backgroundColor: addAlpha(COLORS.gray900, 0.03),
  },
  noteText: {
    ...presets.bodyXS,
    color: COLORS.gray700,
    flex: 1,
  },
  list: {
    gap: spacing[3],
  },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
  },
  pendingDashed: {
    borderStyle: 'dashed',
    borderColor: COLORS.gray300,
    backgroundColor: COLORS.gray100,
  },
  pendingIcon: {
    width: scale(38),
    height: scale(38),
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  pendingBadge: {
    position: 'absolute',
    right: scale(-3),
    bottom: scale(-3),
    width: scale(17),
    height: scale(17),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: borderWidth.medium,
    borderColor: COLORS.white,
  },
  pendingRemove: {
    width: scale(28),
    height: scale(28),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  pendingTexts: {
    flex: 1,
    gap: scale(2),
  },
  pendingName: {
    ...presets.labelMD,
    color: COLORS.gray900,
  },
  pendingMeta: {
    ...presets.bodyXS,
  },
  centered: {
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[6],
  },
  errorText: {
    ...presets.bodySM,
    color: COLORS.gray700,
    textAlign: 'center',
  },
  retryText: {
    ...presets.labelMD,
    color: COLORS.primary,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderStyle: 'dashed',
    borderColor: COLORS.gray300,
    backgroundColor: COLORS.gray100,
  },
  emptyText: {
    ...presets.bodyXS,
    color: COLORS.gray600,
    textAlign: 'center',
  },
});
