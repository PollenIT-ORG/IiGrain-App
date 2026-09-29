import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, ICONS } from '../../components/AppIcon';
import {
  AppHeader,
  AppProgressBar,
  AppText,
  Button,
  ConfirmationModal,
  Input,
} from '../../components';
import { parseISODate } from '../../components/AppDatePicker';
import MonitoringContextCard from '../../components/monitoring/MonitoringContextCard';
import MonitoringFormField from '../../components/monitoring/MonitoringFormField';
import MonitoringAttachments from '../../components/monitoring/MonitoringAttachments';
import AttachmentPickerSheet from '../../components/monitoring/AttachmentPickerSheet';
import { COLORS, borderRadius, borderWidth, presets, shadows, spacing } from '../../constants';
import { addAlpha, moderateScale, scale } from '../../utils';
import {
  NOTES_MAX_LENGTH,
  moduleDef,
  takesFieldPoints,
  type MonitoringFieldDef,
} from '../../config/monitoringModules';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  createRecordThunk,
  deleteDocumentThunk,
  documentBucketKey,
  fetchDocumentsThunk,
  fetchModuleRecordThunk,
  fetchModuleRecordsThunk,
  seedFieldPointsThunk,
  selectDeletingDocumentId,
  selectDocuments,
  selectDocumentsError,
  selectDocumentsLoaded,
  selectDocumentsLoading,
  selectModuleRecords,
  selectMonitoringContext,
  selectMonitoringSaving,
  selectRecordById,
  setMonitoringScope,
  updateRecordThunk,
} from '../../redux/slices/monitoringSlice';
import {
  fieldPointsScopeKey,
  markFieldPointsSeeded,
  selectFieldPointsSeeded,
} from '../../redux/slices/boundarySlice';
import FieldPointsSummary from '../../components/monitoring/FieldPointsSummary';
import { useBoundaryPersistence } from '../../maps/boundary';
import { showSuccess, showToast } from '../../services/toastService';
import { useMonitoringAttachments } from '../../hooks/useMonitoringAttachments';
import {
  buildPayload,
  emptyForm,
  filledFieldCount,
  formFromRecord,
  isFormEmpty,
  numberToText,
  validateRecordForm,
  validateSingleField,
  type FormValue,
  type FormValues,
} from '../../utils/monitoringValues';
import { deleteDocumentFailure } from '../../utils/monitoringErrors';
import type {
  DocumentKind,
  ModuleStatus,
  MonitoringDocument,
  MonitoringFieldErrors,
  UploadFile,
} from '../../types/monitoring';
import type { AppScreenProps } from '../../navigation/navigationTypes';

const GPS_DECIMALS = 6;

const NO_AUTOFILL: FormValues = {};

const NO_DOCUMENTS: MonitoringDocument[] = [];

const attachQueuedMessage = (queued: number, saved: string): string =>
  queued === 1
    ? `${saved}. Your file uploads in the background.`
    : `${saved}. Your ${queued} files upload in the background.`;

type FormRow = { kind: 'fields'; fields: MonitoringFieldDef[] } | { kind: 'position' };

const toRows = (fields: readonly MonitoringFieldDef[]): FormRow[] => {
  const rows: FormRow[] = [];
  let current: MonitoringFieldDef[] = [];
  let capacity = 0;
  let positionPlaced = false;

  const flush = () => {
    if (current.length) {
      rows.push({ kind: 'fields', fields: current });
      current = [];
      capacity = 0;
    }
  };

  for (const field of fields) {
    if (field.gpsPair) {
      if (!positionPlaced) {
        positionPlaced = true;
        flush();
        rows.push({ kind: 'position' });
      }
      continue;
    }
    const width = field.width ?? 'full';
    if (width === 'full') {
      flush();
      rows.push({ kind: 'fields', fields: [field] });
      continue;
    }
    const cap = width === 'half' ? 2 : 3;
    if (current.length && capacity !== cap) {
      flush();
    }
    current.push(field);
    capacity = cap;
    if (current.length === cap) {
      flush();
    }
  }
  flush();
  return rows;
};

const STATUSES: { value: ModuleStatus; label: string; icon: string }[] = [
  { value: 'in_progress', label: 'In progress', icon: ICONS.IN_PROGRESS },
  { value: 'completed', label: 'Completed', icon: ICONS.CHECK },
];

const MonitoringRecordFormScreen: React.FC<AppScreenProps<'MonitoringRecordForm'>> = ({
  route,
  navigation,
}) => {
  const { fieldId, module, recordId, farmId, fieldName } = route.params;
  const isEdit = !!recordId;
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const def = moduleDef(module);

  useEffect(() => {
    dispatch(setMonitoringScope({ fieldId }));
  }, [dispatch, fieldId]);

  const existing = useAppSelector(state =>
    recordId ? selectRecordById(state, module, recordId) : undefined,
  );
  const context = useAppSelector(selectMonitoringContext);
  const saving = useAppSelector(selectMonitoringSaving);

  const [values, setValues] = useState<FormValues>(() => emptyForm(module));
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<ModuleStatus>('in_progress');
  const [errors, setErrors] = useState<MonitoringFieldErrors>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const [autoFilled, setAutoFilled] = useState<FormValues>(NO_AUTOFILL);

  const [pickerOpen, setPickerOpen] = useState(false);
  const attachments = useMonitoringAttachments({
    fieldId,
    module,
    recordId: recordId ?? null,
  });
  const pending = attachments.queued;
  const pendingRows = useMemo(
    () =>
      pending.map(item => ({
        id: item.localId,
        name: item.name,
        sizeBytes: item.sizeBytes,
        status: item.status,
      })),
    [pending],
  );
  const unsaved = useMemo(
    () => pending.filter(item => item.status === 'queued').length,
    [pending],
  );

  const bucket = documentBucketKey(module, recordId ?? null);
  const bucketDocuments = useAppSelector(state => selectDocuments(state, bucket));
  const documents = isEdit ? bucketDocuments : NO_DOCUMENTS;
  const docsLoaded = useAppSelector(state => selectDocumentsLoaded(state, bucket));
  const docsLoading = useAppSelector(state => selectDocumentsLoading(state, bucket));
  const docsError = useAppSelector(state => selectDocumentsError(state, bucket));
  const deletingDocId = useAppSelector(selectDeletingDocumentId);

  const boundary = useBoundaryPersistence({ fieldId, farmId: farmId ?? '' });

  const fieldPoints = useMemo(
    () =>
      (boundary.saved?.ring ?? []).map((point, index) => ({
        label: `Point ${index + 1}`,
        latitude: Number(point.latitude.toFixed(GPS_DECIMALS)),
        longitude: Number(point.longitude.toFixed(GPS_DECIMALS)),
      })),
    [boundary.saved],
  );

  const existingRecords = useAppSelector(state => selectModuleRecords(state, module));
  const pointsSeeded = useAppSelector(state =>
    selectFieldPointsSeeded(state, fieldPointsScopeKey(fieldId, module)),
  );

  const gpsKeys = useMemo(
    () => ({
      latitude: def.fields.find(f => f.gpsPair === 'latitude')?.key ?? null,
      longitude: def.fields.find(f => f.gpsPair === 'longitude')?.key ?? null,
    }),
    [def.fields],
  );

  const valuesRef = useRef(values);
  valuesRef.current = values;

  const notesRef = useRef(notes);
  notesRef.current = notes;
  const statusRef = useRef(status);
  statusRef.current = status;

  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  const baseline = useRef<string>('');
  const hydrated = useRef(false);
  const leaving = useRef(false);

  useEffect(() => {
    if (!isEdit && existingRecords === undefined) {
      dispatch(fetchModuleRecordsThunk({ fieldId, module }));
    }
  }, [dispatch, isEdit, existingRecords, fieldId, module]);

  useEffect(() => {
    if (isEdit && !existing) {
      dispatch(fetchModuleRecordThunk({ fieldId, module, recordId }));
    }
  }, [dispatch, isEdit, existing, fieldId, module, recordId]);

  const loadDocuments = useCallback(() => {
    if (recordId) {
      dispatch(fetchDocumentsThunk({ fieldId, module, recordId }));
    }
  }, [dispatch, fieldId, module, recordId]);

  const docsRequested = useRef(false);
  useEffect(() => {
    if (isEdit && !docsLoaded && !docsRequested.current) {
      docsRequested.current = true;
      loadDocuments();
    }
  }, [isEdit, docsLoaded, loadDocuments]);

  useEffect(() => {
    if (hydrated.current) {
      return;
    }
    if (isEdit) {
      if (!existing) {
        return;
      }
      const next = formFromRecord(module, existing);
      setValues(next);
      setNotes(existing.notes);
      setStatus(existing.status);
      baseline.current = JSON.stringify([next, existing.notes, existing.status]);
    } else {
      baseline.current = JSON.stringify([emptyForm(module), '', 'in_progress']);
    }
    hydrated.current = true;
  }, [isEdit, existing, module]);

  const dirty = useMemo(
    () =>
      hydrated.current &&
      (JSON.stringify([values, notes, status]) !== baseline.current || unsaved > 0),
    [values, notes, status, unsaved],
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', event => {
      if (!dirty || leaving.current) {
        return;
      }
      event.preventDefault();
      setConfirmLeave(true);
    });
    return unsubscribe;
  }, [navigation, dirty]);

  const leave = useCallback(() => {
    leaving.current = true;
    setConfirmLeave(false);
    Promise.all(
      pendingRef.current
        .filter(item => item.status === 'queued')
        .map(item => attachments.remove(item.localId)),
    ).catch(() => undefined);
    navigation.goBack();
  }, [navigation, attachments]);

  const handleChange = useCallback((key: string, value: FormValue) => {
    setValues(current => ({ ...current, [key]: value }));
    setFormMessage(null);
    setErrors(current => {
      if (current[key] === undefined) {
        return current;
      }
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const handleBlur = useCallback(
    (key: string) => {
      const message = validateSingleField(module, key, valuesRef.current);
      setErrors(prev => {
        if (message) {
          return prev[key] === message ? prev : { ...prev, [key]: message };
        }
        if (prev[key] === undefined) {
          return prev;
        }
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [module],
  );

  const stampedRef = useRef(false);
  useEffect(() => {
    if (
      stampedRef.current ||
      isEdit ||
      !hydrated.current ||
      existingRecords === undefined ||
      fieldPoints.length === 0 ||
      !gpsKeys.latitude ||
      !gpsKeys.longitude
    ) {
      return;
    }

    const latKey = gpsKeys.latitude;
    const lngKey = gpsKeys.longitude;

    const taken = new Set(
      existingRecords.map(record => {
        const latitude = Number(record.values[latKey]);
        const longitude = Number(record.values[lngKey]);
        return Number.isFinite(latitude) && Number.isFinite(longitude)
          ? `${latitude.toFixed(GPS_DECIMALS)},${longitude.toFixed(GPS_DECIMALS)}`
          : '';
      }),
    );

    const free =
      fieldPoints.find(
        p => !taken.has(`${p.latitude.toFixed(GPS_DECIMALS)},${p.longitude.toFixed(GPS_DECIMALS)}`),
      ) ?? fieldPoints[0];

    stampedRef.current = true;

    const stamp: FormValues = {
      [latKey]: numberToText(free.latitude),
      [lngKey]: numberToText(free.longitude),
    };
    if (def.titleKey) {
      const held = valuesRef.current[def.titleKey];
      const named = typeof held === 'string' ? held : '';
      if (!named.trim()) {
        stamp[def.titleKey] = free.label;
      }
    }

    const next = { ...valuesRef.current, ...stamp };
    valuesRef.current = next;
    setValues(next);
    setAutoFilled(stamp);
    setErrors(current => {
      const cleared = { ...current };
      delete cleared[latKey];
      delete cleared[lngKey];
      return cleared;
    });

    baseline.current = JSON.stringify([next, notesRef.current, statusRef.current]);
  }, [isEdit, fieldPoints, existingRecords, gpsKeys, def.titleKey]);

  const queueAttachment = useCallback(
    (file: UploadFile, kind: DocumentKind) => {
      setFormMessage(null);
      attachments.add(file, kind).then(
        stored => {
          if (!stored) {
            showToast('Could not keep that file on this device. Try again.', {
              type: 'error',
            });
          }
        },
        () => {
          showToast('Could not keep that file on this device. Try again.', {
            type: 'error',
          });
        },
      );
    },
    [attachments],
  );

  const removePending = useCallback(
    (localId: string) => {
      attachments.remove(localId).catch(() => undefined);
    },
    [attachments],
  );

  const handleDeleteDocument = useCallback(
    async (documentId: string) => {
      if (!recordId) {
        return;
      }
      const action = await dispatch(deleteDocumentThunk({ fieldId, documentId, module, recordId }));
      if (deleteDocumentThunk.fulfilled.match(action) || action.payload?.status === 404) {
        showSuccess('File removed');
        return;
      }
      showToast(deleteDocumentFailure(action.payload), { type: 'error' });
    },
    [dispatch, fieldId, module, recordId],
  );

  const commitAttachments = useCallback(
    (targetRecordId: string): Promise<number> => attachments.commit(targetRecordId),
    [attachments],
  );

  const seedsFieldPoints = takesFieldPoints(module);

  const sendFieldPoints = useCallback(async () => {
    if (!seedsFieldPoints || pointsSeeded || fieldPoints.length === 0) {
      return;
    }
    const action = await dispatch(seedFieldPointsThunk({ fieldId, module, points: fieldPoints }));
    if (seedFieldPointsThunk.fulfilled.match(action) && action.payload.complete) {
      dispatch(markFieldPointsSeeded(fieldPointsScopeKey(fieldId, module)));
    }
  }, [dispatch, seedsFieldPoints, pointsSeeded, fieldPoints, fieldId, module]);

  const filled = useMemo(
    () => filledFieldCount(module, values, isEdit ? undefined : autoFilled),
    [module, values, isEdit, autoFilled],
  );

  const answerable = useMemo(() => def.fields.filter(f => !f.gpsPair).length, [def.fields]);

  const blank = useMemo(
    () => !isEdit && isFormEmpty(module, values, notes, autoFilled),
    [isEdit, module, values, notes, autoFilled],
  );

  const runSave = useCallback(async () => {
    setFormMessage(null);

    const { errors: found, ok } = validateRecordForm(module, values, notes);
    if (!ok) {
      setErrors(found);
      setFormMessage('Please fix the highlighted fields.');
      return;
    }

    if (blank) {
      setFormMessage(`Fill in at least one detail before saving this ${def.noun}.`);
      return;
    }

    const payload = buildPayload(module, values, status, notes);
    leaving.current = true;

    if (isEdit && recordId) {
      const action = await dispatch(
        updateRecordThunk({ fieldId, module, recordId, patch: payload }),
      );
      if (updateRecordThunk.fulfilled.match(action)) {
        await sendFieldPoints();
        const queued = await commitAttachments(recordId);
        if (queued > 0) {
          showSuccess(attachQueuedMessage(queued, 'Record saved'));
        } else {
          showSuccess('Record saved');
        }
        navigation.goBack();
        return;
      }
      if (action.payload?.status === 404) {
        showToast('That record is no longer there. It may have been deleted.', {
          type: 'error',
        });
        navigation.goBack();
        return;
      }
      leaving.current = false;
      const fieldErrors = action.payload?.fieldErrors ?? {};
      setErrors(fieldErrors);
      setFormMessage(action.payload?.message ?? 'Could not save this record.');
      return;
    }

    const action = await dispatch(createRecordThunk({ fieldId, module, payload }));
    if (createRecordThunk.fulfilled.match(action)) {
      await sendFieldPoints();
      const queued = await commitAttachments(action.payload.id);
      if (queued > 0) {
        showSuccess(attachQueuedMessage(queued, 'Record added'));
      } else {
        showSuccess('Record added');
      }
      navigation.replace('MonitoringRecord', {
        fieldId,
        module,
        recordId: action.payload.id,
        farmId,
        fieldName,
      });
      return;
    }
    leaving.current = false;
    const fieldErrors = action.payload?.fieldErrors ?? {};
    setErrors(fieldErrors);
    setFormMessage(action.payload?.message ?? 'Could not add this record.');
  }, [
    dispatch,
    module,
    values,
    notes,
    status,
    isEdit,
    blank,
    recordId,
    fieldId,
    navigation,
    farmId,
    fieldName,
    def.noun,
    sendFieldPoints,
    commitAttachments,
  ]);

  const savingRef = useRef(false);
  const save = useCallback(async () => {
    if (savingRef.current) {
      return;
    }
    savingRef.current = true;
    try {
      await runSave();
    } finally {
      savingRef.current = false;
    }
  }, [runSave]);

  const cancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const rows = useMemo(() => toRows(def.fields), [def.fields]);
  const minimumFor = useCallback(
    (field: MonitoringFieldDef): Date | undefined => {
      if (!field.notBefore) {
        return undefined;
      }
      const other = values[field.notBefore];
      return typeof other === 'string' ? parseISODate(other) ?? undefined : undefined;
    },
    [values],
  );

  const positionError =
    (gpsKeys.latitude ? errors[gpsKeys.latitude] : undefined) ??
    (gpsKeys.longitude ? errors[gpsKeys.longitude] : undefined) ??
    null;

  const busy = saving || attachments.busy;
  const notesLength = notes.length;
  const notesNearLimit = notesLength >= NOTES_MAX_LENGTH * 0.7;
  const meterPercent = answerable > 0 ? Math.min(100, Math.round((filled / answerable) * 100)) : 0;

  return (
    <View style={styles.safe}>
      <AppHeader
        variant="back"
        title={isEdit ? `Edit ${def.noun}` : def.addLabel}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={spacing[6]}>
        <MonitoringContextCard
          title={context?.fieldName || fieldName || 'Field'}
          subtitle={context?.farmName}
          caption={isEdit ? `Editing ${def.noun}` : `New ${def.noun}`}
          captionIcon={isEdit ? 'pencil-outline' : 'plus-circle-outline'}
          meta={def.label}
          icon={def.icon}
        />

        <View style={styles.meterCard}>
          <View style={styles.meterHead}>
            <AppText style={styles.meterTitle}>Details filled</AppText>
            <AppText style={styles.meterCount}>
              {filled} of {answerable}
            </AppText>
          </View>
          <AppProgressBar percent={meterPercent} height={scale(8)} />
          <AppText style={styles.meterHint}>
            {blank
              ? `Nothing entered yet — fill in at least one detail to save this ${def.noun}.`
              : 'Everything here is optional. Save whatever you have; the rest can wait.'}
          </AppText>
        </View>

        {formMessage ? (
          <View style={styles.banner}>
            <AppIcon name={ICONS.ERROR} size={moderateScale(18)} color={COLORS.danger} />
            <AppText style={styles.bannerText}>{formMessage}</AppText>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadIcon}>
              <AppIcon name={def.icon} size={moderateScale(16)} color={COLORS.primary} />
            </View>
            <AppText style={styles.cardTitle}>{def.label}</AppText>
          </View>

          <View style={styles.form}>
            {rows.map((row, rowIndex) => {
              if (row.kind === 'position') {
                return (
                  <FieldPointsSummary
                    key="position"
                    ring={boundary.saved?.ring ?? null}
                    center={boundary.saved?.center ?? null}
                    count={fieldPoints.length}
                    loading={boundary.hydrating && fieldPoints.length === 0}
                    error={positionError}
                  />
                );
              }

              const cells = row.fields;
              return (
                <React.Fragment key={`r-${rowIndex}-${cells.map(f => f.key).join('-')}`}>
                  {cells.length === 1 ? (
                    <MonitoringFormField
                      def={cells[0]}
                      value={values[cells[0].key]}
                      error={errors[cells[0].key]}
                      disabled={saving}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      minimumDate={minimumFor(cells[0])}
                    />
                  ) : (
                    <View style={styles.row}>
                      {cells.map(field => (
                        <View key={field.key} style={styles.rowCell}>
                          <MonitoringFormField
                            def={field}
                            value={values[field.key]}
                            error={errors[field.key]}
                            disabled={saving}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            minimumDate={minimumFor(field)}
                          />
                        </View>
                      ))}
                    </View>
                  )}
                </React.Fragment>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadIcon}>
              <AppIcon name={ICONS.NOTE} size={moderateScale(16)} color={COLORS.primary} />
            </View>
            <AppText style={styles.cardTitle}>Notes</AppText>
          </View>

          <Input
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything else worth recording"
            multiline
            numberOfLines={4}
            maxLength={NOTES_MAX_LENGTH}
            editable={!saving}
            autoCapitalize="sentences"
            error={errors.notes}
            hint={notesNearLimit ? `${notesLength} / ${NOTES_MAX_LENGTH}` : undefined}
            hintTone={notesLength >= NOTES_MAX_LENGTH ? 'warning' : 'muted'}
          />
        </View>

        <MonitoringAttachments
          title="Attachments"
          subtitle={
            isEdit
              ? 'Photos and documents kept against this record.'
              : `Pick files now — they are kept on this device and upload after you save this ${def.noun}.`
          }
          documents={documents}
          loading={isEdit && docsLoading}
          error={isEdit ? docsError : null}
          uploading={attachments.busy}
          deletingId={deletingDocId}
          emptyMessage={
            isEdit
              ? 'Nothing attached to this record yet.'
              : 'Nothing picked yet. Photos and documents can be added before you save.'
          }
          addLabel={pending.length > 0 || documents.length > 0 ? 'Attach another file' : undefined}
          pending={pendingRows}
          onRemovePending={removePending}
          onAdd={() => setPickerOpen(true)}
          onDelete={handleDeleteDocument}
          onRetry={loadDocuments}
        />

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadIcon}>
              <AppIcon name={ICONS.IN_PROGRESS} size={moderateScale(16)} color={COLORS.primary} />
            </View>
            <AppText style={styles.cardTitle}>Status</AppText>
          </View>

          <AppText style={styles.statusHint}>
            Mark it completed once this {def.noun} is finished. You can change it later.
          </AppText>

          <View style={styles.statusRow}>
            {STATUSES.map(option => {
              const active = status === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setStatus(option.value)}
                  disabled={saving}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active, disabled: saving }}
                  style={[styles.statusPill, active && styles.statusPillActive]}>
                  <AppIcon
                    name={option.icon}
                    size={moderateScale(16)}
                    color={active ? COLORS.white : COLORS.gray600}
                  />
                  <AppText style={[styles.statusText, active && styles.statusTextActive]}>
                    {option.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[3] }]}>
          {blank ? (
            <View style={styles.footerNotice}>
              <AppIcon name="information-outline" size={moderateScale(14)} color={COLORS.gray600} />
              <AppText style={styles.footerNoticeText}>
                {unsaved > 0
                  ? 'Enter at least one detail — your files attach on save.'
                  : 'Enter at least one detail to save.'}
              </AppText>
            </View>
          ) : null}

          <View style={styles.footerRow}>
            <View style={styles.footerCancel}>
              <Button title="Cancel" variant="outline" disabled={busy} onPress={cancel} />
            </View>
            <View style={styles.footerSave}>
              <Button
                title={isEdit ? 'Save changes' : def.addLabel}
                loading={busy}
                disabled={blank || busy}
                onPress={save}
              />
            </View>
          </View>
        </View>
      </KeyboardStickyView>

      <AttachmentPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        documentKind={def.defaultDocumentKind}
        onPicked={queueAttachment}
      />

      <ConfirmationModal
        visible={confirmLeave}
        icon="content-save-alert-outline"
        title="Leave without saving?"
        message={
          unsaved > 0
            ? 'This record has changes and picked files that have not been saved. Leaving now discards them.'
            : 'This record has changes that have not been saved. Leaving now discards them.'
        }
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        tone="danger"
        onConfirm={leave}
        onCancel={() => setConfirmLeave(false)}
      />
    </View>
  );
};

export default MonitoringRecordFormScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[8],
    gap: spacing[3],
  },

  meterCard: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[3.5],
    gap: spacing[2],
  },
  meterHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  meterTitle: {
    ...presets.labelMD,
    color: COLORS.gray900,
  },
  meterCount: {
    ...presets.labelMD,
    color: COLORS.primary,
  },
  meterHint: {
    ...presets.bodyXS,
    color: COLORS.gray600,
  },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius['2xl'],
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[4],
    gap: spacing[3],
    ...shadows.xs,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    paddingBottom: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray200,
  },
  cardHeadIcon: {
    width: scale(30),
    height: scale(30),
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.lightPrimary,
  },
  cardTitle: {
    ...presets.labelLG,
    color: COLORS.gray900,
    flex: 1,
  },

  form: {
    gap: spacing[1],
  },
  row: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  rowCell: {
    flex: 1,
  },

  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: addAlpha(COLORS.danger, 0.3),
    backgroundColor: addAlpha(COLORS.danger, 0.08),
  },
  bannerText: {
    ...presets.bodySM,
    color: COLORS.gray900,
    flex: 1,
  },

  statusHint: {
    ...presets.bodyXS,
    color: COLORS.gray600,
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  statusPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray300,
    backgroundColor: COLORS.white,
  },
  statusPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  statusText: {
    ...presets.labelMD,
    color: COLORS.gray700,
  },
  statusTextActive: {
    color: COLORS.white,
  },

  footer: {
    backgroundColor: COLORS.white,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    gap: spacing[2.5],
    borderTopWidth: borderWidth.thin,
    borderTopColor: COLORS.gray200,
    ...shadows.lg,
  },
  footerNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  footerNoticeText: {
    ...presets.bodyXS,
    color: COLORS.gray600,
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  footerCancel: {
    flex: 1,
  },
  footerSave: {
    flex: 1.6,
  },
});
