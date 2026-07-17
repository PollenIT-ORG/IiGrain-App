import React from 'react';
import { Modal, Pressable, StatusBar, StyleSheet, View } from 'react-native';
import Video from 'react-native-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, ICONS } from '../AppIcon';
import { COLORS } from '../../constants';
import { addAlpha } from '../../utils';

export interface AppVideoViewerProps {
  uri: string | null;
  visible: boolean;
  onRequestClose: () => void;
}

const AppVideoViewer: React.FC<AppVideoViewerProps> = ({
  uri,
  visible,
  onRequestClose,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible && !!uri}
      transparent
      animationType="fade"
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={onRequestClose}>
      <View style={styles.backdrop}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

        {uri ? (
          <Video
            source={{ uri }}
            style={styles.video}
            controls
            resizeMode="contain"
            paused={!visible}
            onEnd={onRequestClose}
            onError={onRequestClose}
          />
        ) : null}

        <Pressable
          onPress={onRequestClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close video"
          style={[styles.close, { top: insets.top + 8 }]}>
          <AppIcon name={ICONS.CLOSE} size={26} color={COLORS.white} />
        </Pressable>
      </View>
    </Modal>
  );
};

export default React.memo(AppVideoViewer);

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: COLORS.black },
  video: { ...StyleSheet.absoluteFillObject },
  close: {
    position: 'absolute',
    right: 16,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: addAlpha(COLORS.black, 0.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
