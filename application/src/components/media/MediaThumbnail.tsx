import React, { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { AppIcon, ICONS } from '../AppIcon';
import AppText from '../AppText/AppText';
import { COLORS, borderRadius, presets, spacing, fonts } from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';

export interface MediaThumbnailProps {
  type: 'image' | 'video';
  uri: string;
}

const MediaThumbnail: React.FC<MediaThumbnailProps> = ({ type, uri }) => {
  const [loading, setLoading] = useState(type === 'image');
  const [failed, setFailed] = useState(false);

  if (type === 'video') {
    return (
      <View style={[styles.thumb, styles.videoThumb]}>
        <View style={styles.playBadge}>
          <AppIcon name={ICONS.PLAY} size={moderateScale(26)} color={COLORS.white} />
        </View>
        <View style={styles.tag}>
          <AppText style={styles.tagText}>Video</AppText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.thumb}>
      {failed ? (
        <View style={styles.fallback}>
          <AppIcon name={ICONS.IMAGE} size={moderateScale(28)} color={COLORS.gray500} />
        </View>
      ) : (
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="cover"
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
        />
      )}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : null}
      {!failed ? (
        <View style={styles.zoomBadge}>
          <AppIcon name={ICONS.SEARCH} size={moderateScale(14)} color={COLORS.white} />
        </View>
      ) : null}
    </View>
  );
};

export default React.memo(MediaThumbnail);

const styles = StyleSheet.create({
  thumb: {
    height: scale(168),
    borderRadius: borderRadius.lg,
    backgroundColor: COLORS.gray100,
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray100,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoThumb: {
    backgroundColor: COLORS.gray900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBadge: {
    width: scale(56),
    height: scale(56),
    borderRadius: borderRadius.full,
    backgroundColor: addAlpha(COLORS.white, 0.18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    position: 'absolute',
    bottom: spacing[2],
    left: spacing[2],
    borderRadius: borderRadius.sm,
    backgroundColor: addAlpha(COLORS.black, 0.5),
    paddingHorizontal: spacing[2],
    paddingVertical: scale(2),
  },
  tagText: {
    ...presets.caption,
    color: COLORS.white,
    fontFamily: fonts.semibold,
  },
  zoomBadge: {
    position: 'absolute',
    top: spacing[2],
    right: spacing[2],
    width: scale(28),
    height: scale(28),
    borderRadius: borderRadius.full,
    backgroundColor: addAlpha(COLORS.black, 0.45),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
