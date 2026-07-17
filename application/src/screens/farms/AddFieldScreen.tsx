import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { AppIcon, ICONS } from '../../components/AppIcon';
import {
  AppDatePicker,
  AppHeader,
  AppText,
  Button,
  Input,
  parseISODate,
} from '../../components';
import { COLORS } from '../../constants';
import { moderateScale } from '../../utils';
import { useFormValidation } from '../../hooks';
import type { ValidatorMap } from '../../hooks';
import {
  optionalPositiveNumberValidator,
  requiredNameValidator,
} from '../../utils/fieldValidators';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  createFieldThunk,
  fetchFarmFieldsThunk,
  selectFieldCreating,
  selectFields,
  selectFieldsFarmId,
  selectFieldUpdating,
  updateFieldThunk,
} from '../../redux/slices/fieldSlice';
import {
  fetchFieldSoilRecordThunk,
  saveFieldSoilThunk,
  setSoilField,
  selectSoilRecord,
  selectSoilSaving,
} from '../../redux/slices/soilSlice';
import { showSuccess } from '../../services/toastService';
import { FIELD_HEALTH_META, type FieldHealth } from '../../types/farm';
import type { SaveSoilInput, SoilRecord } from '../../types/fieldDetails';
import type { AppScreenProps } from '../../navigation/navigationTypes';
import SoilDetailsModal, { type SoilValues } from '../../components/farms/SoilDetailsModal';
import LocationPickerModal from '../../components/location/LocationPickerModal';
import type { PickedLocation } from '../../components/location/LocationPicker';
import { selectSelectedFarm } from '../../redux/slices/farmSlice';
import { styles } from './AddFieldScreenStyle';

type FieldFormValues = {
  name: string;
  areaAcres: string;
  crop: string;
  season: string;
  irrigation: string;
  location: string;
  sowingDate: string;
  expectedHarvest: string;
};

const STATUS_OPTIONS: readonly FieldHealth[] = ['healthy', 'monitor', 'critical'];

const STATUS_COLOR: Record<FieldHealth, string> = {
  healthy: COLORS.success,
  monitor: COLORS.warning,
  critical: COLORS.danger,
};

const areaToText = (area: number): string => (area > 0 ? String(area) : '');

const clean = (value: string): string => (value && value !== '-' ? value : '');

const numToText = (n: number | null): string =>
  n === null || n === undefined ? '' : String(n);

const textToNum = (t: string): number | null => {
  const s = t.trim();
  if (!s) {
    return null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const soilHasData = (r: SoilRecord | null): boolean =>
  !!r &&
  (r.ph !== null ||
    r.organicMatter !== null ||
    r.nitrogen !== null ||
    r.phosphorus !== null ||
    r.potassium !== null ||
    r.moisture !== null ||
    !!r.texture ||
    !!r.notes ||
    !!r.testedOnISO);

const AddFieldScreen: React.FC<AppScreenProps<'AddField'>> = ({
  route,
  navigation,
}) => {
  const { farmId, fieldId } = route.params;
  const isEdit = !!fieldId;

  const dispatch = useAppDispatch();
  const creating = useAppSelector(selectFieldCreating);
  const updating = useAppSelector(selectFieldUpdating);
  const fields = useAppSelector(selectFields);
  const fieldsFarmId = useAppSelector(selectFieldsFarmId);
  const selectedFarm = useAppSelector(selectSelectedFarm);
  const saving = isEdit ? updating : creating;

  const [name, setName] = useState('');
  const [areaAcres, setAreaAcres] = useState('');
  const [crop, setCrop] = useState('');
  const [season, setSeason] = useState('');
  const [irrigation, setIrrigation] = useState('');
  const [location, setLocation] = useState('');
  const [sowingDate, setSowingDate] = useState('');
  const [expectedHarvest, setExpectedHarvest] = useState('');
  const [status, setStatus] = useState<FieldHealth>('healthy');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const [soilTexture, setSoilTexture] = useState('');
  const [soilPh, setSoilPh] = useState('');
  const [soilOrganicMatter, setSoilOrganicMatter] = useState('');
  const [soilNitrogen, setSoilNitrogen] = useState('');
  const [soilPhosphorus, setSoilPhosphorus] = useState('');
  const [soilPotassium, setSoilPotassium] = useState('');
  const [soilMoisture, setSoilMoisture] = useState('');
  const [soilTestedOn, setSoilTestedOn] = useState('');
  const [soilNotes, setSoilNotes] = useState('');
  const [soilModalVisible, setSoilModalVisible] = useState(false);

  const soilRecord = useAppSelector(selectSoilRecord);
  const soilSaving = useAppSelector(selectSoilSaving);
  const hadSoilRef = useRef(false);

  const existing = useMemo(
    () => (fieldId ? fields.find(f => f.id === fieldId) : undefined),
    [fields, fieldId],
  );

  const farmCoords = useMemo(
    () =>
      selectedFarm &&
      selectedFarm.id === farmId &&
      selectedFarm.latitude != null &&
      selectedFarm.longitude != null
        ? { latitude: selectedFarm.latitude, longitude: selectedFarm.longitude }
        : null,
    [selectedFarm, farmId],
  );

  const handlePickLocation = useCallback((loc: PickedLocation) => {
    setCoords({ latitude: loc.latitude, longitude: loc.longitude });
    if (loc.address) {
      setLocation(loc.address);
    }
  }, []);

  const seededId = useRef<string | null>(null);
  useEffect(() => {
    if (!isEdit || !fieldId) {
      return;
    }
    if (!existing) {
      if (fieldsFarmId !== farmId && seededId.current !== fieldId) {
        dispatch(fetchFarmFieldsThunk(farmId));
      }
      return;
    }
    if (seededId.current === fieldId) {
      return;
    }
    seededId.current = fieldId;
    setName(existing.name);
    setAreaAcres(areaToText(existing.areaAcres));
    setCrop(clean(existing.crop));
    setSeason(clean(existing.season));
    setIrrigation(clean(existing.irrigation));
    setLocation(clean(existing.coordinates));
    setSowingDate(existing.sowingDateISO || '');
    setExpectedHarvest(existing.expectedHarvestISO || '');
    setStatus(existing.status);
    if (existing.latitude != null && existing.longitude != null) {
      setCoords({ latitude: existing.latitude, longitude: existing.longitude });
    }
  }, [isEdit, fieldId, existing, fieldsFarmId, farmId, dispatch]);

  useEffect(() => {
    if (isEdit && fieldId) {
      dispatch(setSoilField(fieldId));
      dispatch(fetchFieldSoilRecordThunk(fieldId));
    }
  }, [isEdit, fieldId, dispatch]);

  const soilSeededId = useRef<string | null>(null);
  useEffect(() => {
    if (!isEdit || !fieldId || !soilRecord || soilSeededId.current === fieldId) {
      return;
    }
    soilSeededId.current = fieldId;
    hadSoilRef.current = soilHasData(soilRecord);
    setSoilTexture(soilRecord.texture ?? '');
    setSoilPh(numToText(soilRecord.ph));
    setSoilOrganicMatter(numToText(soilRecord.organicMatter));
    setSoilNitrogen(numToText(soilRecord.nitrogen));
    setSoilPhosphorus(numToText(soilRecord.phosphorus));
    setSoilPotassium(numToText(soilRecord.potassium));
    setSoilMoisture(numToText(soilRecord.moisture));
    setSoilTestedOn(soilRecord.testedOnISO ?? '');
    setSoilNotes(soilRecord.notes ?? '');
  }, [isEdit, fieldId, soilRecord]);

  const validators = useMemo<ValidatorMap<FieldFormValues>>(
    () => ({
      name: requiredNameValidator<FieldFormValues>('Field name', 1),
      areaAcres: optionalPositiveNumberValidator<FieldFormValues>(
        'Enter a valid area in acres',
      ),
    }),
    [],
  );

  const { errors, validateField, validateForm } =
    useFormValidation<FieldFormValues>(
      { name, areaAcres, crop, season, irrigation, location, sowingDate, expectedHarvest },
      validators,
    );

  const persistSoil = useCallback(
    async (savedFieldId: string) => {
      const input: SaveSoilInput = {
        ph: textToNum(soilPh),
        organicMatter: textToNum(soilOrganicMatter),
        nitrogen: textToNum(soilNitrogen),
        phosphorus: textToNum(soilPhosphorus),
        potassium: textToNum(soilPotassium),
        moisture: textToNum(soilMoisture),
        texture: soilTexture.trim() || null,
        notes: soilNotes.trim() || null,
        testedOn: soilTestedOn.trim() || null,
      };
      const hasAny =
        input.ph !== null ||
        input.organicMatter !== null ||
        input.nitrogen !== null ||
        input.phosphorus !== null ||
        input.potassium !== null ||
        input.moisture !== null ||
        input.texture !== null ||
        input.notes !== null ||
        input.testedOn !== null;
      if (hasAny || hadSoilRef.current) {
        await dispatch(saveFieldSoilThunk({ fieldId: savedFieldId, input }));
      }
    },
    [
      dispatch,
      soilPh,
      soilOrganicMatter,
      soilNitrogen,
      soilPhosphorus,
      soilPotassium,
      soilMoisture,
      soilTexture,
      soilNotes,
      soilTestedOn,
    ],
  );

  const handleSave = useCallback(async () => {
    if (saving || soilSaving) {
      return;
    }
    if (!validateForm()) {
      return;
    }
    const trimmedArea = areaAcres.trim();
    const area = trimmedArea ? Number(trimmedArea) : undefined;

    if (isEdit && fieldId) {
      const action = await dispatch(
        updateFieldThunk({
          farmId,
          fieldId,
          input: {
            name: name.trim(),
            areaAcres: area ?? null,
            crop: crop.trim() || null,
            season: season.trim() || null,
            irrigation: irrigation.trim() || null,
            location: location.trim() || null,
            latitude: coords?.latitude,
            longitude: coords?.longitude,
            sowingDate: sowingDate.trim() || null,
            expectedHarvest: expectedHarvest.trim() || null,
            status,
          },
        }),
      );
      if (updateFieldThunk.fulfilled.match(action)) {
        await persistSoil(fieldId);
        showSuccess('Field updated');
        navigation.goBack();
      }
      return;
    }

    const action = await dispatch(
      createFieldThunk({
        farmId,
        input: {
          name: name.trim(),
          areaAcres: area,
          crop: crop.trim() || undefined,
          season: season.trim() || undefined,
          irrigation: irrigation.trim() || undefined,
          location: location.trim() || undefined,
          latitude: coords?.latitude,
          longitude: coords?.longitude,
          sowingDate: sowingDate.trim() || undefined,
          expectedHarvest: expectedHarvest.trim() || undefined,
          status,
        },
      }),
    );
    if (createFieldThunk.fulfilled.match(action)) {
      await persistSoil(action.payload.field.id);
      showSuccess('Field added');
      navigation.goBack();
    }
  }, [
    saving,
    soilSaving,
    validateForm,
    areaAcres,
    isEdit,
    fieldId,
    dispatch,
    farmId,
    name,
    crop,
    season,
    irrigation,
    location,
    coords,
    sowingDate,
    expectedHarvest,
    status,
    persistSoil,
    navigation,
  ]);

  const soilValues = useMemo<SoilValues>(
    () => ({
      texture: soilTexture,
      ph: soilPh,
      organicMatter: soilOrganicMatter,
      nitrogen: soilNitrogen,
      phosphorus: soilPhosphorus,
      potassium: soilPotassium,
      moisture: soilMoisture,
      testedOn: soilTestedOn,
      notes: soilNotes,
    }),
    [
      soilTexture,
      soilPh,
      soilOrganicMatter,
      soilNitrogen,
      soilPhosphorus,
      soilPotassium,
      soilMoisture,
      soilTestedOn,
      soilNotes,
    ],
  );

  const handleSoilChange = useCallback((field: keyof SoilValues, value: string) => {
    switch (field) {
      case 'texture': setSoilTexture(value); break;
      case 'ph': setSoilPh(value); break;
      case 'organicMatter': setSoilOrganicMatter(value); break;
      case 'nitrogen': setSoilNitrogen(value); break;
      case 'phosphorus': setSoilPhosphorus(value); break;
      case 'potassium': setSoilPotassium(value); break;
      case 'moisture': setSoilMoisture(value); break;
      case 'testedOn': setSoilTestedOn(value); break;
      case 'notes': setSoilNotes(value); break;
    }
  }, []);

  const filledSoilCount = useMemo(
    () => Object.values(soilValues).filter(v => v.trim().length > 0).length,
    [soilValues],
  );

  return (
    <View style={styles.safe}>
      <AppHeader
        variant="back"
        title={isEdit ? 'Edit Field' : 'Add Field'}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={24}>
        <View style={styles.heroIcon}>
          <AppIcon name={ICONS.FIELD} size={moderateScale(28)} color={COLORS.primary} />
        </View>

        <Input
          label="Field Name"
          placeholder="e.g. North Plot"
          value={name}
          onChangeText={setName}
          onValidate={v => validateField('name', { name: v })}
          error={errors.name}
          autoCapitalize="words"
          returnKeyType="next"
        />

        <Input
          label="Area (acres)"
          placeholder="e.g. 3.5  (optional)"
          value={areaAcres}
          onChangeText={setAreaAcres}
          onValidate={v => validateField('areaAcres', { areaAcres: v })}
          error={errors.areaAcres}
          keyboardType="decimal-pad"
          returnKeyType="next"
        />

        <Input
          label="Crop"
          placeholder="e.g. Rice  (optional)"
          value={crop}
          onChangeText={setCrop}
          autoCapitalize="words"
          returnKeyType="next"
        />

        <Input
          label="Season"
          placeholder="e.g. Kharif 2025  (optional)"
          value={season}
          onChangeText={setSeason}
          autoCapitalize="words"
          returnKeyType="next"
        />

        <Input
          label="Irrigation"
          placeholder="e.g. Rain-fed  (optional)"
          value={irrigation}
          onChangeText={setIrrigation}
          autoCapitalize="words"
          returnKeyType="next"
        />

        <Input
          label="Location"
          placeholder="e.g. 40.71N, 89.59W  (optional)"
          value={location}
          onChangeText={setLocation}
          autoCapitalize="words"
          returnKeyType="next"
        />

        <Pressable
          onPress={() => setPickerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Pick field location on map"
          style={({ pressed }) => [styles.soilTrigger, pressed && styles.soilTriggerPressed]}>
          <View style={styles.soilTriggerIcon}>
            <AppIcon name="map-marker-radius-outline" size={moderateScale(20)} color={COLORS.primary} />
          </View>
          <View style={styles.soilTriggerTexts}>
            <AppText style={styles.soilTriggerTitle}>Location on map</AppText>
            <AppText style={styles.soilTriggerSub} numberOfLines={1}>
              {coords
                ? `📍 ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`
                : 'Tap to pin - starts at the farm’s location'}
            </AppText>
          </View>
          <AppIcon
            name={coords ? 'check-circle' : 'chevron-right'}
            size={moderateScale(coords ? 20 : 22)}
            color={coords ? COLORS.primary : COLORS.gray500}
          />
        </Pressable>

        <AppText style={styles.fieldLabel}>Health Status</AppText>
        <View style={styles.statusRow}>
          {STATUS_OPTIONS.map(option => {
            const active = status === option;
            const accent = STATUS_COLOR[option];
            return (
              <Pressable
                key={option}
                onPress={() => setStatus(option)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.statusChip,
                  active && { backgroundColor: accent, borderColor: accent },
                ]}>
                <View
                  style={[styles.statusDot, { backgroundColor: active ? COLORS.white : accent }]}
                />
                <AppText
                  style={[styles.statusText, active && styles.statusTextActive]}>
                  {FIELD_HEALTH_META[option].label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.dateRow}>
          <View style={styles.dateCol}>
            <AppDatePicker
              label="Sowing Date"
              value={sowingDate || null}
              onChange={setSowingDate}
              maximumDate={parseISODate(expectedHarvest) ?? undefined}
            />
          </View>
          <View style={styles.dateCol}>
            <AppDatePicker
              label="Exp. Harvest"
              value={expectedHarvest || null}
              onChange={setExpectedHarvest}
              minimumDate={parseISODate(sowingDate) ?? undefined}
            />
          </View>
        </View>

        <View style={styles.soilDivider} />
        <Pressable
          onPress={() => setSoilModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Soil information"
          style={({ pressed }) => [styles.soilTrigger, pressed && styles.soilTriggerPressed]}>
          <View style={styles.soilTriggerIcon}>
            <AppIcon name={ICONS.SOIL} size={moderateScale(20)} color={COLORS.primary} />
          </View>
          <View style={styles.soilTriggerTexts}>
            <AppText style={styles.soilTriggerTitle}>Soil Information</AppText>
            <AppText style={styles.soilTriggerSub} numberOfLines={1}>
              {filledSoilCount > 0
                ? `${filledSoilCount} ${filledSoilCount === 1 ? 'detail' : 'details'} added`
                : 'Optional - texture, pH, nutrients…'}
            </AppText>
          </View>
          {filledSoilCount > 0 ? (
            <View style={styles.soilBadge}>
              <AppText style={styles.soilBadgeText}>{filledSoilCount}</AppText>
            </View>
          ) : null}
          <AppIcon name={ICONS.CHEVRON_RIGHT} size={moderateScale(22)} color={COLORS.gray500} />
        </Pressable>

        <Button
          title={isEdit ? 'Save Changes' : 'Create Field'}
          onPress={handleSave}
          loading={saving || soilSaving}
          style={styles.submit}
        />
      </KeyboardAwareScrollView>

      <SoilDetailsModal
        visible={soilModalVisible}
        onClose={() => setSoilModalVisible(false)}
        values={soilValues}
        onChange={handleSoilChange}
      />

      <LocationPickerModal
        visible={pickerVisible}
        initial={coords ?? farmCoords}
        onClose={() => setPickerVisible(false)}
        onConfirm={handlePickLocation}
      />
    </View>
  );
};

export default AddFieldScreen;
