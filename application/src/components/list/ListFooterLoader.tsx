import React, { memo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AppText from '../AppText/AppText';
import { COLORS } from '../../constants';
import { styles } from './ListFooterLoaderStyle';

export interface ListFooterLoaderProps {
  /** True while the next page is in flight. */
  loading: boolean;
  /** True when more pages remain after the loaded ones. */
  hasMore: boolean;
  /** Items currently rendered; the end-of-list note is hidden for short lists. */
  loadedCount: number;
  /** Total across all pages, shown in the end-of-list note. */
  total?: number;
  endLabel?: string;
}

const ListFooterLoader: React.FC<ListFooterLoaderProps> = ({
  loading,
  hasMore,
  loadedCount,
  total,
  endLabel = 'items',
}) => {
  if (loading) {
    return (
      <View style={styles.wrap}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  }

  if (hasMore || loadedCount === 0 || loadedCount <= 10) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <AppText style={styles.endText}>
        {`All ${total ?? loadedCount} ${endLabel} loaded`}
      </AppText>
    </View>
  );
};

export default memo(ListFooterLoader);
