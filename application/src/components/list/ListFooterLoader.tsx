import React, { memo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AppText from '../AppText/AppText';
import { COLORS } from '../../constants';
import { styles } from './ListFooterLoaderStyle';

export interface ListFooterLoaderProps {
  loading: boolean;
  hasMore: boolean;
  loadedCount: number;
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
