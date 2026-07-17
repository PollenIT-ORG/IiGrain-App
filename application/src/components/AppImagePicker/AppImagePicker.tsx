import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  imagePickerService,
} from '../../services/imagePickerService';
import { openAppSettings } from '../../permissions/mediaPermissions';
import type {
  AspectRatio,
  ImagePickerError,
  ImagePickerOptions,
  ImagePickerResult,
  MediaFile,
} from '../../types/media';
import ImagePickerBottomSheet from './ImagePickerBottomSheet';
import ImagePreview from './ImagePreview';
import { styles } from './AppImagePickerStyle';

export interface AppImagePickerProps {
  value: MediaFile[];
  multiple?: boolean;
  maxSelection?: number;
  maxSizeMB?: number;
  aspectRatio?: AspectRatio;
  crop?: boolean;
  mediaType?: 'photo' | 'video' | 'any';
  disabled?: boolean;
  thumbnailSize?: number;
  sheetTitle?: string;
  onChange: (files: MediaFile[]) => void;
  onDelete?: (file: MediaFile) => void;
  onError?: (error: ImagePickerError) => void;
}

const AppImagePicker: React.FC<AppImagePickerProps> = ({
  value,
  multiple = false,
  maxSelection,
  maxSizeMB,
  aspectRatio,
  crop = true,
  mediaType = 'photo',
  disabled = false,
  thumbnailSize,
  sheetTitle,
  onChange,
  onDelete,
  onError,
}) => {
  const [sheetVisible, setSheetVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const effectiveMax = multiple ? maxSelection ?? 10 : 1;
  const remaining = Math.max(effectiveMax - value.length, 0);

  const pickerOptions = useMemo<ImagePickerOptions>(
    () => ({
      multiple,
      maxSelection: multiple ? remaining : 1,
      maxSizeMB,
      crop,
      aspectRatio,
      mediaType,
    }),
    [multiple, remaining, maxSizeMB, crop, aspectRatio, mediaType],
  );

  const handleResult = useCallback(
    (result: ImagePickerResult) => {
      if (result.status === 'cancelled') {
        return;
      }
      if (result.status === 'error') {
        if (result.error.code === 'PERMISSION_BLOCKED') {
          openAppSettings();
        }
        onError?.(result.error);
        return;
      }
      if (multiple) {
        const merged = [...value, ...result.files];
        if (merged.length > effectiveMax) {
          onError?.({
            code: 'LIMIT_EXCEEDED',
            message: `You can add up to ${effectiveMax} images.`,
          });
        }
        onChange(merged.slice(0, effectiveMax));
      } else {
        onChange([result.files[0]]);
      }
    },
    [multiple, value, effectiveMax, onChange, onError],
  );

  const runPick = useCallback(
    async (fn: () => Promise<ImagePickerResult>) => {
      if (loading) {
        return;
      }
      setLoading(true);
      try {
        handleResult(await fn());
      } finally {
        setLoading(false);
      }
    },
    [loading, handleResult],
  );

  const handleCamera = useCallback(
    () => runPick(() => imagePickerService.openCamera(pickerOptions)),
    [runPick, pickerOptions],
  );

  const handleGallery = useCallback(
    () =>
      runPick(() =>
        multiple
          ? imagePickerService.pickMultipleImages(pickerOptions)
          : imagePickerService.pickImage(pickerOptions),
      ),
    [runPick, multiple, pickerOptions],
  );

  const handleRemoveCurrent = useCallback(() => {
    const current = value[0];
    if (current) {
      onDelete?.(current);
    }
  }, [value, onDelete]);

  const handleDeleteThumb = useCallback(
    (file: MediaFile) => onDelete?.(file),
    [onDelete],
  );

  const openSheet = useCallback(() => {
    if (disabled) {
      return;
    }
    if (multiple && remaining <= 0) {
      onError?.({
        code: 'LIMIT_EXCEEDED',
        message: `You can add up to ${effectiveMax} images.`,
      });
      return;
    }
    setSheetVisible(true);
  }, [disabled, multiple, remaining, effectiveMax, onError]);

  const closeSheet = useCallback(() => setSheetVisible(false), []);

  return (
    <View style={styles.container}>
      <ImagePreview
        files={value}
        onDelete={handleDeleteThumb}
        onAddPress={openSheet}
        loading={loading}
        maxSelection={effectiveMax}
        disabled={disabled}
        thumbnailSize={thumbnailSize}
        showCount={multiple}
      />

      <ImagePickerBottomSheet
        visible={sheetVisible}
        onClose={closeSheet}
        onCamera={handleCamera}
        onGallery={handleGallery}
        onRemove={handleRemoveCurrent}
        showRemove={!multiple && value.length > 0}
        title={sheetTitle}
      />
    </View>
  );
};

export default React.memo(AppImagePicker);
