import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText, SearchBar } from '../../components';
import { EmptyState } from '../../components/farms';
import {
  AppShimmer,
  AppShimmerCard,
  AppShimmerCircle,
  AppShimmerList,
  SHIMMER_RADIUS,
} from '../../components/Shimmer';
import AppGradient from '../../components/AppGradient/AppGradient';
import MonitoringContextCard from '../../components/monitoring/MonitoringContextCard';
import MonitoringAttachments from '../../components/monitoring/MonitoringAttachments';
import AttachmentPickerSheet from '../../components/monitoring/AttachmentPickerSheet';
import RecordRow from '../../components/monitoring/RecordRow';
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
  documentBucketKey,
  fetchDocumentsThunk,
  fetchModuleRecordsThunk,
  selectDeletingDocumentId,
  selectDocuments,
  selectDocumentsError,
  selectDocumentsLoaded,
  selectDocumentsLoading,
  selectModuleRecords,
  selectModuleRecordsError,
  selectModuleRecordsLoading,
  selectMonitoringContext,
  selectUploadingBucket,
  setMonitoringScope,
  uploadDocumentThunk,
} from '../../redux/slices/monitoringSlice';
import { showSuccess, showToast } from '../../services/toastService';
import {
  hasValue,
  recordCoords,
  recordTitle,
  summaryLine,
} from '../../utils/monitoringValues';
import { deleteDocumentFailure } from '../../utils/monitoringErrors';
import { useBoundaryPersistence } from '../../maps/boundary';
import { selectFields } from '../../redux/slices/fieldSlice';
import type { DocumentKind, MonitoringRecord, UploadFile } from '../../types/monitoring';
import type { AppScreenProps } from '../../navigation/navigationTypes';

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

const SEARCH_FROM = 6;

const EMPTY_RECORDS: MonitoringRecord[] = [];

const Separator: React.FC = () => <View style={styles.separator} />;

const ListShimmer: React.FC = () => (
  <AppShimmerList
    count={4}
    renderItem={() => (
      <AppShimmerCard style={styles.shimmerCard}>
        <View style={styles.shimmerRow}>
          <AppShimmerCircle size={scale(34)} />
          <View style={styles.shimmerTexts}>
            <AppShimmer width="60%" height={moderateScale(15)} radius={SHIMMER_RADIUS.sm} />
            <AppShimmer width="40%" height={moderateScale(11)} radius={SHIMMER_RADIUS.sm} />
            <AppShimmer width="80%" height={moderateScale(11)} radius={SHIMMER_RADIUS.sm} />
          </View>
        </View>
      </AppShimmerCard>
    )}
  />
);

const MonitoringModuleScreen: React.FC<AppScreenProps<'MonitoringModule'>> = ({
  route,
  navigation,
}) => {
  const { fieldId, module, farmId, fieldName } = route.params;
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const def = moduleDef(module);

  React.useEffect(() => {
    dispatch(setMonitoringScope({ fieldId }));
  }, [dispatch, fieldId]);

  const context = useAppSelector(selectMonitoringContext);
  const records = useAppSelector(state => selectModuleRecords(state, module));
  const loading = useAppSelector(state => selectModuleRecordsLoading(state, module));
  const error = useAppSelector(state => selectModuleRecordsError(state, module));

  const bucket = documentBucketKey(module);
  const allModuleDocs = useAppSelector(state => selectDocuments(state, bucket));
  const docsLoaded = useAppSelector(state => selectDocumentsLoaded(state, bucket));
  const docsLoading = useAppSelector(state => selectDocumentsLoading(state, bucket));
  const docsError = useAppSelector(state => selectDocumentsError(state, bucket));
  const uploadingBucket = useAppSelector(selectUploadingBucket);
  const deletingDocId = useAppSelector(selectDeletingDocumentId);

  const loadRecords = useCallback(() => {
    dispatch(fetchModuleRecordsThunk({ fieldId, module }));
  }, [dispatch, fieldId, module]);

  const loadDocuments = useCallback(() => {
    dispatch(fetchDocumentsThunk({ fieldId, module }));
  }, [dispatch, fieldId, module]);

  const moduleTag = Tags.monitoringModule(fieldId, module);

  useSyncedFetch({
    tags: [moduleTag],
    run: loadRecords,
    hasData: records !== undefined,
  });

  useSyncedFetch({
    tags: [`${moduleTag}:docs`, moduleTag],
    run: loadDocuments,
    hasData: docsLoaded,
  });

  const looseDocs = useMemo(
    () => allModuleDocs.filter(d => d.recordId === null),
    [allModuleDocs],
  );

  const [query, setQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const showsMap = def.fields.some(f => f.gpsPair);
  const boundary = useBoundaryPersistence({ fieldId, farmId: farmId ?? '' });
  const fields = useAppSelector(selectFields);
  const fieldCenter = useMemo(() => {
    const match = fields.find(f => f.id === fieldId);
    return match?.latitude != null && match?.longitude != null
      ? { latitude: match.latitude, longitude: match.longitude }
      : null;
  }, [fields, fieldId]);

  const list = useMemo(() => records ?? EMPTY_RECORDS, [records]);

  const mapPoints = useMemo<SamplePoint[]>(() => {
    if (!showsMap) {
      return [];
    }
    const presenceKey = def.presence?.key;
    return list.flatMap((record, index) => {
      const coords = recordCoords(module, record);
      if (!coords) {
        return [];
      }
      return [
        {
          id: record.id,
          label: recordTitle(module, record) || `Point ${index + 1}`,
          latitude: coords.latitude,
          longitude: coords.longitude,
          sampled: presenceKey
            ? hasValue(record.values[presenceKey])
            : record.status === 'completed',
        },
      ];
    });
  }, [showsMap, list, module, def.presence]);
  const showSearch = list.length >= SEARCH_FROM;

  const completedCount = useMemo(
    () => list.filter(record => record.status === 'completed').length,
    [list],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || !showSearch) {
      return list;
    }
    return list.filter(record => {
      const haystack = `${recordTitle(module, record)} ${summaryLine(module, record)} ${
        record.notes
      }`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [query, list, module, showSearch]);

  const openRecord = useCallback(
    (record: MonitoringRecord) => {
      navigation.navigate('MonitoringRecord', {
        fieldId,
        module,
        recordId: record.id,
        farmId,
        fieldName,
      });
    },
    [navigation, fieldId, module, farmId, fieldName],
  );

  const openRecordById = useCallback(
    (id: string) => {
      const match = list.find(r => r.id === id);
      if (match) {
        openRecord(match);
      }
    },
    [list, openRecord],
  );

  const addRecord = useCallback(() => {
    navigation.navigate('MonitoringRecordForm', {
      fieldId,
      module,
      farmId,
      fieldName,
    });
  }, [navigation, fieldId, module, farmId, fieldName]);

  const handleUpload = useCallback(
    async (file: UploadFile, kind: DocumentKind) => {
      const action = await dispatch(
        uploadDocumentThunk({ fieldId, module, kind, file }),
      );
      if (uploadDocumentThunk.fulfilled.match(action)) {
        showSuccess('File attached');
      } else {
        showToast(action.payload?.message ?? 'Upload failed. Please try again.', {
          type: 'error',
        });
      }
    },
    [dispatch, fieldId, module],
  );

  const handleDeleteDocument = useCallback(
    async (documentId: string) => {
      const action = await dispatch(
        deleteDocumentThunk({ fieldId, documentId, module }),
      );
      if (deleteDocumentThunk.fulfilled.match(action)) {
        showSuccess('File removed');
      } else if (action.payload?.status === 404) {
        showSuccess('File removed');
      } else {
        showToast(deleteDocumentFailure(action.payload), { type: 'error' });
      }
    },
    [dispatch, fieldId, module],
  );

  const refresh = useCallback(() => {
    loadRecords();
    loadDocuments();
  }, [loadRecords, loadDocuments]);

  const header = (
    <View style={styles.headerBlock}>
      <MonitoringContextCard
        title={context?.fieldName || fieldName || 'Field'}
        subtitle={context?.farmName}
        caption={`${list.length} ${list.length === 1 ? 'record' : 'records'}`}
        captionIcon="clipboard-text-outline"
        meta={list.length > 0 ? `${completedCount} completed` : undefined}
        icon={def.icon}
      />

      <View style={styles.moduleCard}>
        <View style={styles.moduleLine}>
          <AppText style={styles.moduleTitle}>{def.label}</AppText>
          <View style={styles.countChip}>
            <AppText style={styles.countChipText}>
              {list.length} {list.length === 1 ? 'record' : 'records'}
            </AppText>
          </View>
        </View>
        <AppText style={styles.moduleDescription}>{def.description}</AppText>
      </View>

      {showsMap && list.length > 0 ? (
        <SamplePointsMap
          points={mapPoints}
          ring={boundary.saved?.ring ?? null}
          fallbackCenter={boundary.saved?.center ?? fieldCenter}
          totalPoints={list.length}
          onPressPoint={openRecordById}
        />
      ) : null}

      {showSearch ? (
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={`Search ${def.noun}s`}
        />
      ) : null}
    </View>
  );

  const footer = (
    <View style={styles.footerBlock}>
      <MonitoringAttachments
        title="Module documents"
        subtitle="Files kept against this module rather than one record."
        documents={looseDocs}
        loading={docsLoading}
        error={docsError}
        uploading={uploadingBucket === bucket}
        deletingId={deletingDocId}
        emptyMessage="No documents uploaded for this module yet."
        onAdd={() => setPickerOpen(true)}
        onDelete={handleDeleteDocument}
        onRetry={loadDocuments}
      />
    </View>
  );

  const empty = () => {
    if (records === undefined && loading) {
      return <ListShimmer />;
    }
    if (records === undefined && error) {
      return (
        <View style={styles.stateBox}>
          <AppIcon name={ICONS.ERROR} size={moderateScale(36)} color={COLORS.gray500} />
          <AppText style={styles.stateText}>{error}</AppText>
          <TouchableOpacity onPress={loadRecords} hitSlop={HIT_SLOP} accessibilityRole="button">
            <AppText style={styles.retryText}>Retry</AppText>
          </TouchableOpacity>
        </View>
      );
    }
    if (query.trim() && list.length > 0) {
      return (
        <AppText style={styles.noMatch}>
          Nothing here matches “{query.trim()}”.
        </AppText>
      );
    }
    return (
      <EmptyState
        icon={def.icon}
        title={def.emptyTitle}
        message={def.emptyMessage}
        actionLabel={def.addLabel}
        onAction={addRecord}
      />
    );
  };

  return (
    <View style={styles.safe}>
      <AppHeader variant="back" title={def.label} onBack={() => navigation.goBack()} />

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <RecordRow module={module} record={item} onPress={openRecord} />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty()}
        ListFooterComponent={footer}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + scale(96) },
        ]}
        ItemSeparatorComponent={Separator}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={loading && records !== undefined}
            onRefresh={refresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      />

      <TouchableOpacity
        activeOpacity={0.88}
        onPress={addRecord}
        accessibilityRole="button"
        accessibilityLabel={def.addLabel}
        style={[styles.fab, { bottom: insets.bottom + spacing[4] }]}>
        <AppGradient variant="fab" style={styles.fabInner}>
          <AppIcon name={ICONS.PLUS} size={moderateScale(20)} color={COLORS.white} />
          <AppText style={styles.fabText}>{def.addLabel}</AppText>
        </AppGradient>
      </TouchableOpacity>

      <AttachmentPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        documentKind={def.defaultDocumentKind}
        onPicked={handleUpload}
      />
    </View>
  );
};

export default MonitoringModuleScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  content: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    gap: 0,
  },
  separator: {
    height: spacing[3],
  },

  headerBlock: {
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  moduleCard: {
    backgroundColor: COLORS.white,
    borderRadius: borderRadius.xl,
    borderWidth: borderWidth.thin,
    borderColor: COLORS.gray200,
    padding: spacing[3.5],
    gap: spacing[1.5],
  },
  moduleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  moduleTitle: {
    ...presets.headingSM,
    color: COLORS.gray900,
    flex: 1,
  },
  countChip: {
    paddingHorizontal: spacing[2.5],
    paddingVertical: scale(4),
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.lightPrimary,
  },
  countChipText: {
    ...presets.labelSM,
    fontSize: moderateScale(11),
    color: COLORS.primary,
  },
  moduleDescription: {
    ...presets.bodyXS,
    color: COLORS.gray600,
  },

  footerBlock: {
    marginTop: spacing[6],
  },

  stateBox: {
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[10],
  },
  stateText: {
    ...presets.bodySM,
    color: COLORS.gray700,
    textAlign: 'center',
  },
  retryText: {
    ...presets.labelMD,
    color: COLORS.primary,
  },
  noMatch: {
    ...presets.bodySM,
    color: COLORS.gray600,
    textAlign: 'center',
    paddingVertical: spacing[8],
  },

  fab: {
    position: 'absolute',
    right: spacing[4],
    borderRadius: borderRadius.full,
    ...shadows.lg,
  },
  fabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingLeft: spacing[4],
    paddingRight: spacing[5],
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  fabText: {
    ...presets.buttonSM,
    color: COLORS.white,
  },

  shimmerCard: {
    gap: spacing[3],
  },
  shimmerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  shimmerTexts: {
    flex: 1,
    gap: spacing[2],
  },
});
