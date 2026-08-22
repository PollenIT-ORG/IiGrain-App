import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, ICONS } from '../AppIcon';
import AppText from '../AppText/AppText';
import { COLORS, borderRadius, borderWidth, presets, shadows, spacing } from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';
import { getExtension } from '../../utils/fileType';
import {
  DOCUMENT_EXTENSIONS,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_KIND_LABELS,
} from '../../config/monitoringModules';
import { pickDocument } from '../../services/documentPickerService';
import { imagePickerService } from '../../services/imagePickerService';
import type { DocumentKind, UploadFile } from '../../types/monitoring';

export interface AttachmentPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  documentKind: DocumentKind;
  onPicked: (file: UploadFile, kind: DocumentKind) => void;
}

const MB = 1024 * 1024;

const sizeText = (bytes: number): string => `${(bytes / MB).toFixed(1)} MB`;

const rejectionFor = (file: UploadFile): string | null => {
  const ext = getExtension(file.name) || getExtension(file.uri);
  if (!ext || !DOCUMENT_EXTENSIONS.includes(ext)) {
    return `That file type is not accepted. Attach a PDF, an image, or a Word document.`;
  }
  if (typeof file.size === 'number' && file.size > DOCUMENT_MAX_BYTES) {
    return `That file is ${sizeText(file.size)}. Files can be up to 10 MB.`;
  }
  return null;
};

interface Choice {
  key: string;
  icon: string;
  title: string;
  subtitle: string;
}

const CHOICES: Choice[] = [
  {
    key: 'camera',
    icon: ICONS.CAMERA,
    title: 'Take a photo',
    subtitle: 'Use the camera',
  },
  {
    key: 'gallery',
    icon: ICONS.GALLERY,
    title: 'Choose a photo',
    subtitle: 'Pick from your gallery',
  },
  {
    key: 'file',
    icon: ICONS.DOCUMENT,
    title: 'Upload a file',
    subtitle: 'PDF, image or Word, up to 10 MB',
  },
];

const AttachmentPickerSheet: React.FC<AttachmentPickerSheetProps> = ({
  visible,
  onClose,
  documentKind,
  onPicked,
}) => {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const finish = useCallback(
    (file: UploadFile, kind: DocumentKind) => {
      const rejection = rejectionFor(file);
      if (rejection) {
        setProblem(rejection);
        return;
      }
      setProblem(null);
      onClose();
      onPicked(file, kind);
    },
    [onClose, onPicked],
  );

  const takePhoto = useCallback(
    async (source: 'camera' | 'gallery') => {
      setBusy(source);
      setProblem(null);
      try {
        const result =
          source === 'camera'
            ? await imagePickerService.openCamera({ crop: false, maxSizeMB: 10 })
            : await imagePickerService.pickImage({ crop: false, maxSizeMB: 10 });

        if (result.status === 'error') {
          setProblem(result.error.message);
          return;
        }
        if (result.status !== 'success') {
          return;
        }
        const picked = result.files[0];
        if (!picked) {
          return;
        }
        finish(
          { uri: picked.uri, name: picked.name, mime: picked.mime, size: picked.size },
          'photo',
        );
      } finally {
        setBusy(null);
      }
    },
    [finish],
  );

  const chooseFile = useCallback(async () => {
    setBusy('file');
    setProblem(null);
    try {
      const picked = await pickDocument();
      if (!picked) {
        return;
      }
      finish(
        { uri: picked.uri, name: picked.name, mime: picked.mime, size: picked.size },
        documentKind,
      );
    } catch {
      setProblem('Could not open the file picker.');
    } finally {
      setBusy(null);
    }
  }, [finish, documentKind]);

  const close = useCallback(() => {
    setProblem(null);
    onClose();
  }, [onClose]);

  const run = useCallback(
    (key: string) => {
      if (busy) {
        return;
      }
      if (key === 'file') {
        chooseFile();
        return;
      }
      takePhoto(key === 'camera' ? 'camera' : 'gallery');
    },
    [busy, chooseFile, takePhoto],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}>
      <TouchableWithoutFeedback onPress={busy ? undefined : close}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing[4] }]}>
              <View style={styles.grabber} />

              <AppText style={styles.title}>Attach a file</AppText>
              <AppText style={styles.subtitle}>
                Files picked from storage are filed as a{' '}
                {DOCUMENT_KIND_LABELS[documentKind].toLowerCase()}.
              </AppText>

              {problem ? (
                <View style={styles.problem}>
                  <AppIcon
                    name={ICONS.ERROR}
                    size={moderateScale(18)}
                    color={COLORS.danger}
                  />
                  <AppText style={styles.problemText}>{problem}</AppText>
                </View>
              ) : null}

              {CHOICES.map(choice => {
                const running = busy === choice.key;
                return (
                  <Pressable
                    key={choice.key}
                    onPress={() => run(choice.key)}
                    disabled={!!busy}
                    accessibilityRole="button"
                    accessibilityLabel={choice.title}
                    style={({ pressed }) => [
                      styles.choice,
                      pressed && !busy && styles.choicePressed,
                      !!busy && !running && styles.choiceDimmed,
                    ]}>
                    <View style={styles.choiceIcon}>
                      {running ? (
                        <ActivityIndicator size="small" color={COLORS.primary} />
                      ) : (
                        <AppIcon
                          name={choice.icon}
                          size={moderateScale(20)}
                          color={COLORS.primary}
                        />
                      )}
                    </View>
                    <View style={styles.choiceTexts}>
                      <AppText style={styles.choiceTitle}>{choice.title}</AppText>
                      <AppText style={styles.choiceSubtitle}>{choice.subtitle}</AppText>
                    </View>
                    <AppIcon
                      name={ICONS.CHEVRON_RIGHT}
                      size={moderateScale(18)}
                      color={COLORS.gray500}
                    />
                  </Pressable>
                );
              })}

              <Pressable
                onPress={close}
                disabled={!!busy}
                accessibilityRole="button"
                style={styles.cancel}>
                <AppText style={styles.cancelText}>Cancel</AppText>
              </Pressable>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default React.memo(AttachmentPickerSheet);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: borderRadius['3xl'],
    borderTopRightRadius: borderRadius['3xl'],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    gap: spacing[2],
    ...shadows.md,
  },
  grabber: {
    alignSelf: 'center',
    width: scale(40),
    height: scale(4),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.gray300,
    marginBottom: spacing[3],
  },
  title: {
    ...presets.headingSM,
    color: COLORS.gray900,
  },
  subtitle: {
    ...presets.bodyXS,
    color: COLORS.gray600,
    marginBottom: spacing[2],
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    backgroundColor: COLORS.white,
  },
  choicePressed: {
    backgroundColor: COLORS.lightPrimaryBg,
    borderColor: COLORS.primaryLighter,
  },
  choiceDimmed: {
    opacity: 0.5,
  },
  choiceIcon: {
    width: scale(38),
    height: scale(38),
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: addAlpha(COLORS.primary, 0.1),
  },
  choiceTexts: {
    flex: 1,
    gap: scale(2),
  },
  choiceTitle: {
    ...presets.labelLG,
    color: COLORS.gray900,
  },
  choiceSubtitle: {
    ...presets.bodyXS,
    color: COLORS.gray600,
  },
  problem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    padding: spacing[3],
    marginBottom: spacing[1],
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: addAlpha(COLORS.danger, 0.3),
    backgroundColor: addAlpha(COLORS.danger, 0.08),
  },
  problemText: {
    ...presets.bodySM,
    color: COLORS.gray900,
    flex: 1,
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: spacing[3],
    marginTop: spacing[1],
  },
  cancelText: {
    ...presets.labelLG,
    color: COLORS.gray700,
  },
});
