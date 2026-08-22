import React, { useCallback, useEffect, useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { COLORS, borderRadius, presets, spacing } from '../constants';
import { moderateScale, scale } from '../utils';
import { AppIcon } from './AppIcon';
import AppText from './AppText/AppText';
import { presentationFor } from '../utils/resolveError';
import { setErrorHandler } from '../services/errorService';
import type { ErrorPresentation, ErrorSeverity } from '../config/errorMessages';

const ACCENT: Record<ErrorSeverity, string> = {
  error: COLORS.danger,
  warning: COLORS.warning,
  validation: COLORS.validation,
  info: COLORS.infoBlue,
  success: COLORS.success,
};

const ICON_BG: Record<ErrorSeverity, string> = {
  error: 'rgba(229, 72, 77, 0.12)',
  warning: 'rgba(244, 183, 64, 0.16)',
  validation: 'rgba(227, 100, 20, 0.14)',
  info: 'rgba(19, 106, 203, 0.12)',
  success: 'rgba(47, 191, 113, 0.14)',
};

interface ErrorState {
  visible: boolean;
  presentation: ErrorPresentation;
}

const INITIAL: ErrorState = {
  visible: false,
  presentation: presentationFor('UNKNOWN'),
};

const GlobalErrorModal: React.FC = () => {
  const [state, setState] = useState<ErrorState>(INITIAL);

  useEffect(() => {
    setErrorHandler(presentation => setState({ visible: true, presentation }));
    return () => setErrorHandler(null);
  }, []);

  const dismiss = useCallback(() => {
    setState(prev => ({ ...prev, visible: false }));
  }, []);

  const { title, message, icon, severity, buttonText } = state.presentation;
  const accent = ACCENT[severity] ?? ACCENT.error;

  return (
    <Modal
      visible={state.visible}
      transparent
      animationType="fade"
      onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: ICON_BG[severity] }]}>
            <AppIcon name={icon} size={moderateScale(26)} color={accent} />
          </View>

          <AppText style={styles.title}>{title}</AppText>
          <AppText style={styles.message}>{message}</AppText>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: accent }]}
            onPress={dismiss}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={buttonText}>
            <AppText style={styles.buttonText}>{buttonText}</AppText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[8],
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    padding: spacing[6],
    alignItems: 'center',
  },
  iconWrap: {
    width: scale(56),
    height: scale(56),
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  title: {
    ...presets.headingSM,
    color: COLORS.gray900,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  message: {
    ...presets.bodySM,
    color: COLORS.gray700,
    textAlign: 'center',
    marginBottom: spacing[5],
  },
  button: {
    alignSelf: 'stretch',
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  buttonText: {
    ...presets.buttonLG,
    color: COLORS.white,
  },
});

export default GlobalErrorModal;
