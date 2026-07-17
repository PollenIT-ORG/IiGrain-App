import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import AppText from '../AppText/AppText';
import { COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing, fonts } from '../../constants';
import { formatDate, moderateScale, scale } from '../../utils';
import { classifyMedia } from '../../utils/fileType';
import { DEFAULT_ENTRY, type DownloadEntry } from '../../hooks/useFileDownloads';
import { toFileUri } from '../../services/fileDownloadService';
import type { FieldDocument } from '../../types/fieldDetails';
import FileTypeIcon from './FileTypeIcon';
import MediaThumbnail from './MediaThumbnail';
import DownloadStatusButton from './DownloadStatusButton';

export interface AttachmentCardProps {
  doc: FieldDocument;
  entry?: DownloadEntry;
  deleting: boolean;
  onPreview: (doc: FieldDocument, previewUri: string) => void;
  onDownload: (doc: FieldDocument) => void;
  onDelete: (doc: FieldDocument) => void;
  onShare: (doc: FieldDocument) => void;
}

const HITSLOP = { top: 8, bottom: 8, left: 8, right: 8 };

const AttachmentCard: React.FC<AttachmentCardProps> = ({
  doc,
  entry = DEFAULT_ENTRY,
  deleting,
  onPreview,
  onDownload,
  onDelete,
  onShare,
}) => {
  const meta = useMemo(() => classifyMedia(doc), [doc]);
  const isMedia = meta.type === 'image' || meta.type === 'video';

  const previewUri =
    entry.status === 'exists' && entry.localPath ? toFileUri(entry.localPath) : doc.url;

  const handlePreview = useCallback(
    () => onPreview(doc, previewUri),
    [onPreview, doc, previewUri],
  );
  const handleDownload = useCallback(() => onDownload(doc), [onDownload, doc]);
  const handleDelete = useCallback(() => onDelete(doc), [onDelete, doc]);
  const handleShare = useCallback(() => onShare(doc), [onShare, doc]);

  const metaLine = `${meta.label} · ${doc.sizeLabel}${
    doc.uploadedAtISO ? ` · ${formatDate(doc.uploadedAtISO)}` : ''
  }`;

  const actionBar = (
    <View style={styles.actionBar}>
      <DownloadStatusButton entry={entry} onDownload={handleDownload} />
      <View style={styles.actionIcons}>
        <TouchableOpacity
          style={styles.iconBtn}
          hitSlop={HITSLOP}
          onPress={handleShare}
          accessibilityRole="button"
          accessibilityLabel="Share">
          <AppIcon name="share-variant-outline" size={moderateScale(20)} color={COLORS.gray600} />
        </TouchableOpacity>
        {deleting ? (
          <ActivityIndicator size="small" color={COLORS.primary} style={styles.iconBtn} />
        ) : (
          <TouchableOpacity
            style={styles.iconBtn}
            hitSlop={HITSLOP}
            onPress={handleDelete}
            accessibilityRole="button"
            accessibilityLabel="Delete">
            <AppIcon name={ICONS.DELETE} size={moderateScale(20)} color={COLORS.danger} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (isMedia) {
    return (
      <View style={styles.card}>
        <Pressable
          onPress={handlePreview}
          accessibilityRole="imagebutton"
          accessibilityLabel={`Open ${doc.name}`}>
          <MediaThumbnail type={meta.type as 'image' | 'video'} uri={previewUri} />
        </Pressable>
        <View style={styles.textWrap}>
          <AppText style={styles.title} numberOfLines={1}>
            {doc.name}
          </AppText>
          <AppText style={styles.meta} numberOfLines={1}>
            {metaLine}
          </AppText>
        </View>
        {actionBar}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.docRow}
        onPress={handlePreview}
        accessibilityRole="button"
        accessibilityLabel={`Open ${doc.name}`}>
        <FileTypeIcon icon={meta.icon} color={meta.color} />
        <View style={styles.docText}>
          <AppText style={styles.title} numberOfLines={2}>
            {doc.name}
          </AppText>
          <AppText style={styles.meta} numberOfLines={1}>
            {metaLine}
          </AppText>
        </View>
        <View style={styles.openHint}>
          <AppText style={styles.openText}>Open</AppText>
          <AppIcon name={ICONS.CHEVRON_RIGHT} size={moderateScale(16)} color={COLORS.primary} />
        </View>
      </Pressable>
      {actionBar}
    </View>
  );
};

export default React.memo(AttachmentCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[3],
    ...shadows.sm,
  },
  textWrap: {
    marginTop: spacing[3],
    gap: scale(2),
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  docText: {
    flex: 1,
    gap: scale(2),
  },
  title: {
    ...presets.labelLG,
    color: COLORS.gray900,
  },
  meta: {
    ...presets.bodyXS,
    color: COLORS.gray500,
  },
  openHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(2),
  },
  openText: {
    ...presets.labelSM,
    color: COLORS.primary,
    fontFamily: fonts.semibold,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[3],
    paddingTop: spacing[2.5],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.gray200,
  },
  actionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  iconBtn: {
    padding: spacing[2],
  },
});
