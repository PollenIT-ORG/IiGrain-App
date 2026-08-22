import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, ICONS } from '../../components/AppIcon';
import {
  AppHeader,
  AppOverflowMenu,
  AppStatusBadge,
  AppText,
  Button,
  ConfirmationModal,
} from '../../components';
import type { OverflowMenuItem } from '../../components';
import {
  AppShimmer,
  AppShimmerCard,
  AppShimmerText,
  SHIMMER_RADIUS,
} from '../../components/Shimmer';
import MonitoringContextCard from '../../components/monitoring/MonitoringContextCard';
import MonitoringAttachments from '../../components/monitoring/MonitoringAttachments';
import AttachmentPickerSheet from '../../components/monitoring/AttachmentPickerSheet';
import SamplePointsMap, {
  type SamplePoint,
} from '../../components/monitoring/SamplePointsMap';
import {
  COLORS,
  borderRadius,
  borderWidth,
  presets,
  shadows,
  spacing,
} from '../../constants';
import { moderateScale, scale } from '../../utils';
import { moduleDef } from '../../config/monitoringModules';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { useSyncedFetch } from '../../hooks/useSyncedFetch';
import { Tags } from '../../redux/syncTags';
import {
  deleteDocumentThunk,
  deleteRecordThunk,
  documentBucketKey,
  fetchDocumentsThunk,
  fetchModuleRecordThunk,
  selectDeletingDocumentId,
  selectDeletingRecordId,
  selectDocuments,
  selectDocumentsError,
  selectDocumentsLoaded,
  selectDocumentsLoading,
  selectMonitoringContext,
  selectMonitoringSaving,
  selectRecordById,
  selectUploadingBucket,
  setMonitoringScope,
  updateRecordThunk,
  uploadDocumentThunk,
} from '../../redux/slices/monitoringSlice';
import { showSuccess, showToast } from '../../services/toastService';
import {
  displayValue,
  formatCoords,
  formatDateOnly,
  hasValue,
  recordCoords,
  recordTitle,
} from '../../utils/monitoringValues';
import { useBoundaryPersistence } from '../../maps/boundary';
import type { DocumentKind, UploadFile } from '../../types/monitoring';
import type { AppScreenProps } from '../../navigation/navigationTypes';

const NOT_RECORDED = 'Not recorded';

const MonitoringRecordScreen: React.FC<AppScreenProps<'MonitoringRecord'>> = ({
  route,
  navigation,
}) => {
  const { programId, fieldId, module, recordId, farmId, fieldName, programName } =
    route.params;
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const def = moduleDef(module);

  useEffect(() => {
    dispatch(setMonitoringScope({ programId, fieldId }));
  }, [dispatch, programId, fieldId]);

  const record = useAppSelector(state => selectRecordById(state, module, recordId));
  const context = useAppSelector(selectMonitoringContext);
  const saving = useAppSelector(selectMonitoringSaving);
  const deletingRecordId = useAppSelector(selectDeletingRecordId);

  const bucket = documentBucketKey(module, recordId);
  const documents = useAppSelector(state => selectDocuments(state, bucket));
  const docsLoaded = useAppSelector(state => selectDocumentsLoaded(state, bucket));
  const docsLoading = useAppSelector(state => selectDocumentsLoading(state, bucket));
  const docsError = useAppSelector(state => selectDocumentsError(state, bucket));
  const uploadingBucket = useAppSelector(selectUploadingBucket);
  const deletingDocId = useAppSelector(selectDeletingDocumentId);

  const [missing, setMissing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadRecord = useCallback(async () => {
    const action = await dispatch(
      fetchModuleRecordThunk({ programId, fieldId, module, recordId }),
    );
    if (fetchModuleRecordThunk.rejected.match(action) && action.payload?.status === 404) {
      setMissing(true);
    }
  }, [dispatch, programId, fieldId, module, recordId]);

  const loadDocuments = useCallback(() => {
    dispatch(fetchDocumentsThunk({ programId, fieldId, module, recordId }));
  }, [dispatch, programId, fieldId, module, recordId]);

  const moduleTag = Tags.monitoringModule(programId, fieldId, module);

  useSyncedFetch({
    tags: [`${moduleTag}:${recordId}`, moduleTag],
    run: loadRecord,
    hasData: record !== undefined,
  });

  useSyncedFetch({
    tags: [`${moduleTag}:${recordId}:docs`, moduleTag],
    run: loadDocuments,
    hasData: docsLoaded,
  });

  const goneRef = useRef(false);
  useEffect(() => {
    if (missing && !goneRef.current) {
      goneRef.current = true;
      showToast('That record is no longer there. It may have been deleted.', {
        type: 'error',
      });
      navigation.goBack();
    }
  }, [missing, navigation]);

  const coords = useMemo(
    () => (record ? recordCoords(module, record) : null),
    [module, record],
  );
  const boundary = useBoundaryPersistence({ fieldId, farmId: farmId ?? '' });

  const mapPoints = useMemo<SamplePoint[]>(() => {
    if (!record || !coords) {
      return [];
    }
    const presenceKey = def.presence?.key;
    return [
      {
        id: record.id,
        label: recordTitle(module, record),
        latitude: coords.latitude,
        longitude: coords.longitude,
        sampled: presenceKey
          ? hasValue(record.values[presenceKey])
          : record.status === 'completed',
      },
    ];
  }, [record, coords, module, def.presence]);

  const rows = useMemo(() => {
    if (!record) {
      return [];
    }
    return def.fields.map(field => ({
      key: field.key,
      label: field.label,
      value: displayValue(field, record.values[field.key]) || NOT_RECORDED,
      filled: !!displayValue(field, record.values[field.key]),
    }));
  }, [record, def.fields]);

  const filledCount = useMemo(() => rows.filter(r => r.filled).length, [rows]);

  const goToEdit = useCallback(() => {
    navigation.navigate('MonitoringRecordForm', {
      programId,
      fieldId,
      module,
      recordId,
      farmId,
      fieldName,
      programName,
    });
  }, [navigation, programId, fieldId, module, recordId, farmId, fieldName, programName]);

  const toggleStatus = useCallback(async () => {
    if (!record) {
      return;
    }
    const next = record.status === 'completed' ? 'in_progress' : 'completed';
    const action = await dispatch(
      updateRecordThunk({
        programId,
        fieldId,
        module,
        recordId,
        patch: { status: next },
      }),
    );
    if (updateRecordThunk.fulfilled.match(action)) {
      showSuccess(next === 'completed' ? 'Marked as completed' : 'Reopened');
    } else {
      showToast(action.payload?.message ?? 'Could not update this record.', {
        type: 'error',
      });
    }
  }, [dispatch, record, programId, fieldId, module, recordId]);

  const runDelete = useCallback(async () => {
    const action = await dispatch(
      deleteRecordThunk({ programId, fieldId, module, recordId }),
    );
    setConfirmDelete(false);
    if (deleteRecordThunk.fulfilled.match(action)) {
      showSuccess(`${def.noun.charAt(0).toUpperCase()}${def.noun.slice(1)} deleted`);
      navigation.goBack();
      return;
    }
    if (action.payload?.status === 404) {
      showToast('That record was already removed.', { type: 'error' });
      navigation.goBack();
      return;
    }
    showToast(action.payload?.message ?? 'Could not delete this record.', {
      type: 'error',
    });
  }, [dispatch, programId, fieldId, module, recordId, navigation, def.noun]);

  const handleUpload = useCallback(
    async (file: UploadFile, kind: DocumentKind) => {
      const action = await dispatch(
        uploadDocumentThunk({ programId, fieldId, module, recordId, kind, file }),
      );
      if (uploadDocumentThunk.fulfilled.match(action)) {
        showSuccess('File attached');
      } else {
        showToast(action.payload?.message ?? 'Upload failed. Please try again.', {
          type: 'error',
        });
      }
    },
    [dispatch, programId, fieldId, module, recordId],
  );

  const handleDeleteDocument = useCallback(
    async (documentId: string) => {
      const action = await dispatch(
        deleteDocumentThunk({ programId, fieldId, documentId, module, recordId }),
      );
      if (deleteDocumentThunk.fulfilled.match(action)) {
        showSuccess('File removed');
      } else {
        showToast(action.payload?.message ?? 'Could not remove that file.', {
          type: 'error',
        });
      }
    },
    [dispatch, programId, fieldId, module, recordId],
  );

  const menuItems = useMemo<OverflowMenuItem[]>(
    () => [
      { key: 'edit', icon: ICONS.EDIT, title: 'Edit record', onPress: goToEdit },
      {
        key: 'delete',
        icon: ICONS.DELETE,
        title: 'Delete record',
        destructive: true,
        onPress: () => setConfirmDelete(true),
        loading: deletingRecordId === recordId,
      },
    ],
    [goToEdit, deletingRecordId, recordId],
  );

  const title = record ? recordTitle(module, record) : def.label;
  const presence = def.presence;
  const presenceFilled = presence && record ? rows.some(r => r.key === presence.key && r.filled) : false;
  const completed = record?.status === 'completed';

  return (
    <View style={styles.safe}>
      <AppHeader
        variant="back"
        title={def.label}
        onBack={() => navigation.goBack()}
        rightActions={null}
        rightComponent={
          record ? (
            <AppOverflowMenu items={menuItems} accessibilityLabel="Record actions" />
          ) : undefined
        }
      />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + scale(112) },
        ]}
        showsVerticalScrollIndicator={false}>
        <MonitoringContextCard
          title={context?.fieldName || fieldName || 'Field'}
          subtitle={context?.farmName}
          caption={context?.programName || programName}
          icon={def.icon}
        />

        {!record ? (
          <AppShimmerCard>
            <AppShimmer width="55%" height={moderateScale(18)} radius={SHIMMER_RADIUS.sm} />
            <View style={styles.shimmerGap} />
            <AppShimmerText count={6} spacing={spacing[3]} lastLineWidth="60%" />
          </AppShimmerCard>
        ) : (
          <>
            <View style={styles.titleCard}>
              <View
                style={[
                  styles.titleIcon,
                  completed && styles.titleIconDone,
                ]}>
                <AppIcon
                  name={completed ? ICONS.CHECK : def.icon}
                  size={moderateScale(20)}
                  color={completed ? COLORS.white : COLORS.primary}
                />
              </View>

              <View style={styles.titleTexts}>
                <AppText style={styles.title} numberOfLines={2}>
                  {title}
                </AppText>
                {record.updatedAtISO ? (
                  <AppText style={styles.updated}>
                    Last updated {formatDateOnly(record.updatedAtISO)}
                  </AppText>
                ) : null}
              </View>

              {presence ? (
                <AppStatusBadge
                  size="sm"
                  label={presenceFilled ? presence.present : presence.absent}
                  tone={presenceFilled ? 'success' : 'neutral'}
                />
              ) : (
                <AppStatusBadge size="sm" status={record.status} />
              )}
            </View>

            {coords ? (
              <View style={styles.mapCard}>
                <View style={styles.mapClip}>
                  <SamplePointsMap
                    points={mapPoints}
                    ring={boundary.saved?.ring ?? null}
                    fallbackCenter={{
                      latitude: coords.latitude,
                      longitude: coords.longitude,
                    }}
                    totalPoints={1}
                    height={scale(180)}
                  />
                </View>
                <View style={styles.coordRow}>
                  <View style={styles.coordIcon}>
                    <AppIcon
                      name={ICONS.LOCATION}
                      size={moderateScale(15)}
                      color={COLORS.primary}
                    />
                  </View>
                  <View style={styles.coordTexts}>
                    <AppText style={styles.coordLabel}>POSITION</AppText>
                    <AppText style={styles.coordText} selectable>
                      {formatCoords(coords.latitude, coords.longitude)}
                    </AppText>
                  </View>
                </View>
              </View>
            ) : def.presence ? (
              <View style={styles.noCoordCard}>
                <AppIcon
                  name="map-marker-off-outline"
                  size={moderateScale(16)}
                  color={COLORS.gray600}
                />
                <AppText style={styles.noCoordText}>
                  This point has no position from the field’s boundary.
                </AppText>
              </View>
            ) : null}

            <View style={styles.card}>
              <View style={styles.cardHead}>
                <AppText style={styles.cardTitle}>Recorded details</AppText>
                <View style={styles.cardChip}>
                  <AppText style={styles.cardChipText}>
                    {filledCount} of {rows.length}
                  </AppText>
                </View>
              </View>

              {rows.map((row, index) => (
                <View
                  key={row.key}
                  style={[styles.row, index < rows.length - 1 && styles.rowDivider]}>
                  <View style={styles.rowHead}>
                    <View
                      style={[styles.dot, row.filled ? styles.dotFilled : styles.dotEmpty]}
                    />
                    <AppText style={styles.rowLabel}>{row.label}</AppText>
                  </View>
                  <AppText
                    style={[styles.rowValue, !row.filled && styles.rowValueEmpty]}
                    numberOfLines={4}>
                    {row.value}
                  </AppText>
                </View>
              ))}
            </View>

            <View style={styles.notesCard}>
              <View style={styles.notesHeader}>
                <AppIcon name={ICONS.NOTE} size={moderateScale(16)} color={COLORS.primary} />
                <AppText style={styles.notesTitle}>Notes</AppText>
              </View>
              <AppText style={[styles.notesText, !record.notes && styles.rowValueEmpty]}>
                {record.notes || 'No notes on this record.'}
              </AppText>
            </View>

            <View style={styles.attachmentsBlock}>
              <MonitoringAttachments
                title="Attachments"
                subtitle="Photos and documents kept against this record."
                documents={documents}
                loading={docsLoading}
                error={docsError}
                uploading={uploadingBucket === bucket}
                deletingId={deletingDocId}
                emptyMessage="Nothing attached to this record yet."
                onAdd={() => setPickerOpen(true)}
                onDelete={handleDeleteDocument}
                onRetry={loadDocuments}
              />
            </View>
          </>
        )}
      </ScrollView>

      {record ? (
        <View style={[styles.actionBar, { paddingBottom: insets.bottom + spacing[3] }]}>
          <View style={styles.actionEdit}>
            <Button
              title="Edit"
              variant="outline"
              onPress={goToEdit}
              leftIcon={
                <AppIcon name={ICONS.EDIT} size={moderateScale(18)} color={COLORS.primary} />
              }
            />
          </View>
          <View style={styles.actionPrimary}>
            <Button
              title={completed ? 'Reopen' : 'Mark completed'}
              loading={saving}
              onPress={toggleStatus}
              leftIcon={
                <AppIcon
                  name={completed ? ICONS.RETRY : ICONS.CHECK}
                  size={moderateScale(18)}
                  color={COLORS.white}
                />
              }
            />
          </View>
        </View>
      ) : null}

      <AttachmentPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        documentKind={def.defaultDocumentKind}
        onPicked={handleUpload}
      />

      <ConfirmationModal
        visible={confirmDelete}
        tone="danger"
        icon={ICONS.DELETE}
        title={`Delete this ${def.noun}?`}
        message={`"${title}" and everything attached to it will be removed. This cannot be undone.`}
        consequences={['The record and all of its values', 'Any files attached to it']}
        confirmLabel="Delete"
        loading={deletingRecordId === recordId}
        onConfirm={runDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </View>
  );
};

export default MonitoringRecordScreen;

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
    gap: spacing[3],
  },

  titleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: COLORS.white,
    borderRadius: borderRadius['2xl'],
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[4],
    ...shadows.sm,
  },
  titleIcon: {
    width: scale(44),
    height: scale(44),
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.lightPrimary,
  },
  titleIconDone: {
    backgroundColor: COLORS.primary,
  },
  titleTexts: {
    flex: 1,
    gap: scale(3),
  },
  title: {
    ...presets.headingMD,
    color: COLORS.gray900,
  },
  updated: {
    ...presets.bodyXS,
    color: COLORS.gray600,
  },

  mapCard: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius['2xl'],
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[2],
    gap: spacing[2],
    ...shadows.sm,
  },
  mapClip: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  coordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
  },
  coordIcon: {
    width: scale(30),
    height: scale(30),
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.lightPrimary,
  },
  coordTexts: {
    flex: 1,
    gap: scale(1),
  },
  coordLabel: {
    ...presets.labelSM,
    fontSize: moderateScale(10),
    letterSpacing: 0.8,
    color: COLORS.gray600,
  },
  coordText: {
    ...presets.labelMD,
    color: COLORS.gray900,
  },
  noCoordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    backgroundColor: COLORS.white,
  },
  noCoordText: {
    ...presets.bodyXS,
    color: COLORS.gray700,
    flex: 1,
  },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius['2xl'],
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[1],
    ...shadows.sm,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
    paddingVertical: spacing[3.5],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray200,
  },
  cardTitle: {
    ...presets.labelLG,
    color: COLORS.gray900,
  },
  cardChip: {
    paddingHorizontal: spacing[2.5],
    paddingVertical: scale(4),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.lightPrimary,
  },
  cardChipText: {
    ...presets.labelSM,
    fontSize: moderateScale(11),
    color: COLORS.primary,
  },
  row: {
    gap: scale(4),
    paddingVertical: spacing[3],
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray200,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  dot: {
    width: scale(6),
    height: scale(6),
    borderRadius: borderRadius.full,
  },
  dotFilled: {
    backgroundColor: COLORS.primary,
  },
  dotEmpty: {
    backgroundColor: COLORS.gray300,
  },
  rowLabel: {
    ...presets.bodyXS,
    color: COLORS.gray600,
    flex: 1,
  },
  rowValue: {
    ...presets.labelLG,
    color: COLORS.gray900,
    paddingLeft: scale(14),
  },
  rowValueEmpty: {
    ...presets.bodySM,
    color: COLORS.gray500,
  },

  notesCard: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius['2xl'],
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[4],
    gap: spacing[2],
    ...shadows.sm,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  notesTitle: {
    ...presets.labelLG,
    color: COLORS.gray900,
  },
  notesText: {
    ...presets.bodySM,
    color: COLORS.gray900,
  },

  attachmentsBlock: {
    marginTop: spacing[1],
  },

  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    backgroundColor: COLORS.white,
    borderTopWidth: borderWidth.thin,
    borderTopColor: COLORS.gray200,
    ...shadows.lg,
  },
  actionEdit: {
    flex: 1,
  },
  actionPrimary: {
    flex: 1.6,
  },

  shimmerGap: {
    height: spacing[3],
  },
});
