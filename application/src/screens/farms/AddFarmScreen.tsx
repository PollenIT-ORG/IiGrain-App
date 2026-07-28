import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText, Button, Input } from '../../components';
import { LocationPickerModal, type PickedLocation } from '../../maps';
import { API_LIMITS, COLORS } from '../../constants';
import { moderateScale } from '../../utils';
import { useFormValidation } from '../../hooks';
import type { ValidatorMap } from '../../hooks';
import {
  requiredNameValidator,
  requiredPositiveNumberValidator,
} from '../../utils/fieldValidators';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  createFarmThunk,
  fetchFarmDetailThunk,
  selectFarmCreating,
  selectFarmUpdating,
  selectSelectedFarm,
  updateFarmThunk,
} from '../../redux/slices/farmSlice';
import { showSuccess } from '../../services/toastService';
import type { AppScreenProps } from '../../navigation/navigationTypes';
import { styles } from './AddFarmScreenStyle';

type FarmFormValues = {
  name: string;
  areaAcres: string;
  location: string;
};

const areaToText = (area: number): string => (area > 0 ? String(area) : '');

const AddFarmScreen: React.FC<AppScreenProps<'AddFarm'>> = ({ route, navigation }) => {
  const farmId = route.params?.farmId;
  const isEdit = !!farmId;

  const dispatch = useAppDispatch();
  const creating = useAppSelector(selectFarmCreating);
  const updating = useAppSelector(selectFarmUpdating);
  const selectedFarm = useAppSelector(selectSelectedFarm);
  const saving = isEdit ? updating : creating;

  const [name, setName] = useState('');
  const [businessEntity, setBusinessEntity] = useState('');
  const [areaAcres, setAreaAcres] = useState('');
  const [location, setLocation] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const seededId = useRef<string | null>(null);
  useEffect(() => {
    if (!isEdit) {
      return;
    }
    if (!selectedFarm || selectedFarm.id !== farmId) {
      if (seededId.current !== farmId) {
        dispatch(fetchFarmDetailThunk(farmId));
      }
      return;
    }
    if (seededId.current === farmId) {
      return;
    }
    seededId.current = farmId;
    setName(selectedFarm.name);
    setBusinessEntity(selectedFarm.businessEntity ?? '');
    setAreaAcres(areaToText(selectedFarm.areaAcres));
    setLocation(selectedFarm.location ?? '');
    if (selectedFarm.latitude != null && selectedFarm.longitude != null) {
      setCoords({ latitude: selectedFarm.latitude, longitude: selectedFarm.longitude });
    }
  }, [isEdit, farmId, selectedFarm, dispatch]);

  const handlePickLocation = useCallback((loc: PickedLocation) => {
    setCoords({ latitude: loc.latitude, longitude: loc.longitude });
    if (loc.address) {
      setLocation(loc.address);
    }
  }, []);

  const validators = useMemo<ValidatorMap<FarmFormValues>>(
    () => ({
      name: requiredNameValidator<FarmFormValues>('Farm name', 2),
      areaAcres: requiredPositiveNumberValidator<FarmFormValues>(
        'Area',
        'Enter a valid area in acres',
      ),
    }),
    [],
  );

  const { errors, validateField, validateForm } = useFormValidation<FarmFormValues>(
    { name, areaAcres, location },
    validators,
  );

  const handleSave = useCallback(async () => {
    if (saving) {
      return;
    }
    if (!validateForm()) {
      return;
    }
    const trimmedArea = areaAcres.trim();
    const area = trimmedArea ? Number(trimmedArea) : undefined;
    const loc = location.trim();
    const entity = businessEntity.trim();

    if (isEdit) {
      const action = await dispatch(
        updateFarmThunk({
          farmId,
          input: {
            name: name.trim(),
            // Sent even when empty so clearing the field clears it server-side.
            businessEntity: entity,
            areaAcres: area,
            location: loc,
            latitude: coords?.latitude,
            longitude: coords?.longitude,
          },
        }),
      );
      if (updateFarmThunk.fulfilled.match(action)) {
        showSuccess('Farm updated');
        navigation.goBack();
      }
      return;
    }

    const action = await dispatch(
      createFarmThunk({
        name: name.trim(),
        businessEntity: entity || undefined,
        areaAcres: area,
        location: loc || undefined,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      }),
    );
    if (createFarmThunk.fulfilled.match(action)) {
      showSuccess('Farm created');
      navigation.goBack();
    }
  }, [
    saving,
    validateForm,
    areaAcres,
    location,
    businessEntity,
    coords,
    isEdit,
    dispatch,
    farmId,
    name,
    navigation,
  ]);

  return (
    <View style={styles.safe}>
      <AppHeader
        variant="back"
        title={isEdit ? 'Edit Farm' : 'Add Farm'}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={24}>
        <View style={styles.heroIcon}>
          <AppIcon name={ICONS.FARM} size={moderateScale(28)} color={COLORS.primary} />
        </View>

        <Input
          label="Farm Name"
          required
          placeholder="e.g. North Field"
          value={name}
          onChangeText={setName}
          onValidate={v => validateField('name', { name: v })}
          error={errors.name}
          autoCapitalize="words"
          returnKeyType="next"
          maxLength={API_LIMITS.farm.name}
        />

        <Input
          label="Business Entity"
          placeholder="e.g. Green Valley Farms LLC  (optional)"
          value={businessEntity}
          onChangeText={setBusinessEntity}
          autoCapitalize="words"
          returnKeyType="next"
          maxLength={API_LIMITS.farm.businessEntity}
        />

        <Input
          label="Area (acres)"
          required
          placeholder="e.g. 12.5"
          value={areaAcres}
          onChangeText={setAreaAcres}
          onValidate={v => validateField('areaAcres', { areaAcres: v })}
          error={errors.areaAcres}
          keyboardType="decimal-pad"
          returnKeyType="next"
        />

        <Input
          label="Location"
          placeholder="e.g. Nashik, Maharashtra  (optional)"
          value={location}
          onChangeText={setLocation}
          autoCapitalize="words"
          multiline
          // A map-picked address can be long — wrap it inside the field instead
          // of overflowing the box (iOS doesn't clip overflow like Android).
          blurOnSubmit
          returnKeyType="done"
          onSubmitEditing={handleSave}
          maxLength={API_LIMITS.farm.location}
        />

        <Pressable
          onPress={() => setPickerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Pick location on map"
          style={({ pressed }) => [styles.mapBtn, pressed && styles.mapBtnPressed]}>
          <View style={styles.mapBtnIcon}>
            <AppIcon name="map-marker-radius-outline" size={moderateScale(22)} color={COLORS.primary} />
          </View>
          <View style={styles.mapBtnTexts}>
            <AppText style={styles.mapBtnTitle}>Location on map</AppText>
            <AppText style={styles.mapBtnSub} numberOfLines={1}>
              {coords
                ? `📍 ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`
                : 'Tap to pin the exact spot on the map'}
            </AppText>
          </View>
          <AppIcon
            name={coords ? 'check-circle' : 'chevron-right'}
            size={moderateScale(coords ? 20 : 22)}
            color={coords ? COLORS.primary : COLORS.gray500}
          />
        </Pressable>

        <Button
          title={isEdit ? 'Save Changes' : 'Create Farm'}
          onPress={handleSave}
          loading={saving}
          style={styles.submit}
        />
      </KeyboardAwareScrollView>

      <LocationPickerModal
        visible={pickerVisible}
        initial={coords}
        onClose={() => setPickerVisible(false)}
        onConfirm={handlePickLocation}
      />
    </View>
  );
};

export default AddFarmScreen;
