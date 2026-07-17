import React, { useCallback, useEffect, useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { COLORS, presets } from '../constants';
import AppText from './AppText/AppText';
import { setErrorHandler, ShowErrorOptions } from '../services/errorService';

interface ErrorState {
  visible: boolean;
  title: string;
  message: string;
}

const INITIAL: ErrorState = { visible: false, title: 'Something went wrong', message: '' };

const GlobalErrorModal: React.FC = () => {
  const [state, setState] = useState<ErrorState>(INITIAL);

  useEffect(() => {
    const handler = (message: string, options?: ShowErrorOptions) => {
      setState({
        visible: true,
        title: options?.title ?? 'Something went wrong',
        message,
      });
    };
    setErrorHandler(handler);
    return () => setErrorHandler(null);
  }, []);

  const dismiss = useCallback(() => {
    setState(prev => ({ ...prev, visible: false }));
  }, []);

  return (
    <Modal
      visible={state.visible}
      transparent
      animationType="fade"
      onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <AppText style={styles.title}>{state.title}</AppText>
          <AppText style={styles.message}>{state.message}</AppText>
          <TouchableOpacity style={styles.button} onPress={dismiss} activeOpacity={0.8}>
            <AppText style={styles.buttonText}>OK</AppText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
  },
  title: {
    ...presets.headingSM,
    color: COLORS.gray900,
    marginBottom: 8,
  },
  message: {
    ...presets.bodySM,
    color: COLORS.gray700,
    marginBottom: 20,
  },
  button: {
    alignSelf: 'flex-end',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  buttonText: {
    ...presets.buttonLG,
    color: COLORS.white,
  },
});

export default GlobalErrorModal;
