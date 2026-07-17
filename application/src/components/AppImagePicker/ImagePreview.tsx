import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  spacing,
} from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';
import AppText from '../AppText/AppText';
import type { MediaFile } from '../../types/media';

export interface ImagePreviewProps {
  files: MediaFile[];
  onDelete: (file: MediaFile) => void;
  onAddPress?: () => void;
  loading?: boolean;
  maxSelection?: number;
  disabled?: boolean;
  thumbnailSize?: number;
  showCount?: boolean;
}

const ICON_FOR_TYPE: Record<MediaFile['type'], string> = {
  image: 'file-image-outline',
  video: 'file-video-outline',
};

const ImagePreview: React.FC<ImagePreviewProps> = ({
  files,
  onDelete,
  onAddPress,
  loading = false,
  maxSelection,
  disabled = false,
  thumbnailSize = scale(72),
  showCount,
}) => {
  const atMax = typeof maxSelection === 'number' && files.length >= maxSelection;
  const canAdd = !!onAddPress && !disabled && !atMax;
  const displayCount =
    showCount ?? (typeof maxSelection === 'number' && maxSelection > 1);

  const tileStyle = { width: thumbnailSize, height: thumbnailSize };

  const renderItem = useCallback<ListRenderItem<MediaFile>>(
    ({ item }) => (
      <View style={[styles.tile, tileStyle]}>
        {item.type === 'image' ? (
          <Image source={{ uri: item.uri }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={styles.docTile}>
            <AppIcon name={ICON_FOR_TYPE[item.type]} size={moderateScale(26)} color={COLORS.primary} />
          </View>
        )}

        {!disabled ? (
          <Pressable
            style={styles.removeBtn}
            onPress={() => onDelete(item)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.name}`}>
            <AppIcon name={ICONS.CLOSE} size={moderateScale(13)} color={COLORS.white} />
          </Pressable>
        ) : null}
      </View>
    ),
    [disabled, onDelete, thumbnailSize], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const keyExtractor = useCallback((item: MediaFile) => item.id, []);

  const footer = (
    <View style={styles.footerRow}>
      {loading ? (
        <View style={[styles.tile, styles.busyTile, tileStyle]}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : null}
      {canAdd ? (
        <Pressable
          style={[styles.addTile, tileStyle]}
          onPress={onAddPress}
          accessibilityRole="button"
          accessibilityLabel="Add image">
          <AppIcon name={ICONS.PLUS} size={moderateScale(26)} color={COLORS.gray500} />
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View>
      {displayCount ? (
        <AppText style={styles.count} color={COLORS.gray600}>
          {files.length}
          {typeof maxSelection === 'number' ? ` / ${maxSelection}` : ''} selected
        </AppText>
      ) : null}

      {files.length > 0 ? (
        <FlatList
          horizontal
          data={files}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={footer}
        />
      ) : (
        footer
      )}
    </View>
  );
};

export default React.memo(ImagePreview);

const styles = StyleSheet.create({
  count: {
    ...presets.bodyXS,
    marginBottom: spacing[2],
  },
  listContent: {
    gap: spacing[3],
    alignItems: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  tile: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: COLORS.gray100,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  docTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    borderRadius: borderRadius.md,
  },
  busyTile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
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
    borderRadius: borderRadius.md,
    borderWidth: borderWidth.medium,
    borderColor: COLORS.gray300,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray100,
  },
});
