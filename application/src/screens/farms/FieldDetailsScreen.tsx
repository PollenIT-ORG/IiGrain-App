import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import AppImageViewer from '../../components/AppImageViewer/AppImageViewer';
import AppVideoViewer from '../../components/AppVideoViewer/AppVideoViewer';
import { AppIcon, ICONS } from '../../components/AppIcon';
import {
  AppHeader,
  AppOverflowMenu,
  AppText,
  Button,
  ConfirmationModal,
  parseISOMonth,
} from '../../components';
import type { OverflowMenuItem } from '../../components';
import {
  EmptyState,
  InfoRow,
  SectionHeader,
  StatCard,
  Timeline,
} from '../../components/farms';
import { COLORS, spacing } from '../../constants';
import { formatDate, moderateScale, scale } from '../../utils';
import { formatAcres } from '../../maps/utils/fieldAcres';
import type { MapFocusHandle } from '../../maps/types';
import { useSyncedFetch } from '../../hooks/useSyncedFetch';
import { Tags } from '../../redux/syncTags';
import {
  AppShimmer,
  AppShimmerCard,
  AppShimmerChip,
  AppShimmerCircle,
  AppShimmerImage,
  AppShimmerSection,
  AppShimmerText,
  SHIMMER_RADIUS,
  shimmerLayout,
} from '../../components/Shimmer';
import type { AppScreenProps } from '../../navigation/navigationTypes';
import { styles } from './FieldDetailsScreenStyle';
import { AnimatedTabBar } from '../../components/';
import { FieldLocationPreview } from '../../maps';
import {
  BoundaryPreviewMap,
  useBoundaryPersistence,
  useBoundaryRepository,
} from '../../maps/boundary';
import { selectBoundary } from '../../redux/slices/boundarySlice';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  fetchFarmFieldsThunk,
  refreshFarmFieldsThunk,
  selectFields,
  selectFieldsError,
  selectFieldsFarmId,
  selectFieldsLoading,
} from '../../redux/slices/fieldSlice';
import {
  fetchFarmDetailThunk,
  refreshFarmDetailThunk,
  selectSelectedFarm,
} from '../../redux/slices/farmSlice';
import {
  setActiveField,
  fetchFieldOverviewThunk,
  fetchFieldActivityThunk,
  fetchFieldSoilThunk,
  fetchFieldDocumentsThunk,
  uploadFieldDocumentThunk,
  deleteFieldDocumentThunk,
  selectFieldDetailsFieldId,
  selectFieldOverview,
  selectFieldActivity,
  selectFieldSoil,
  selectFieldDocuments,
  selectFieldTabLoading,
  selectFieldTabError,
  selectUploadingDoc,
  selectDeletingDocId,
} from '../../redux/slices/fieldDetailsSlice';
import { showToast, showSuccess } from '../../services/toastService';
import SoilDetailsModal, { type SoilValues } from '../../components/farms/SoilDetailsModal';
import {
  resetFieldThunk,
  deleteFieldThunk,
} from '../../redux/thunks/fieldThunks';
import {
  selectFieldDeleting,
  selectFieldResetting,
} from '../../redux/slices/fieldSlice';
import {
  fetchFieldSoilRecordThunk,
  saveFieldSoilThunk,
  selectSoilFieldId,
  selectSoilRecord,
  selectSoilSaving,
  setSoilField,
} from '../../redux/slices/soilSlice';
import type { SaveSoilInput } from '../../types/fieldDetails';
import { pickDocument } from '../../services/documentPickerService';
import type { FieldDocument } from '../../types/fieldDetails';
import { AttachmentCard } from '../../components/media';
import { useFileDownloads } from '../../hooks/useFileDownloads';
import { toFileUri } from '../../services/fileDownloadService';
import { classifyMedia } from '../../utils/fileType';
import MonitoringModulesView from '../monitoring/MonitoringModulesView';

const MAP_BUTTON_HIT_SLOP = { top: 6, bottom: 6, left: 6, right: 6 };

type FieldTab = 'overview' | 'history' | 'soil' | 'documents' ;
// | 'monitoring';

type PendingAction = 'reset' | 'delete' | null;

const FILTER_TABS: { key: FieldTab; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'view-dashboard-outline' },
  { key: 'history', label: 'History', icon: 'history' },
  { key: 'soil', label: 'Soil', icon: 'layers-outline' },
  { key: 'documents', label: 'Docs', icon: 'file-document-outline' },
  // { key: 'monitoring', label: 'Monitoring', icon: 'clipboard-list-outline' },
];

const DOC_HITSLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const formatMonth = (iso?: string | null): string => {
  const parsed = parseISOMonth(iso);
  return parsed ? `${MONTH_LABELS[parsed.month]} ${parsed.year}` : '—';
};

const StatTileShimmer: React.FC = () => (
  <AppShimmerCard style={skStyles.statTile}>
    <AppShimmerCircle size={scale(36)} />
    <AppShimmer width="55%" height={moderateScale(16)} radius={SHIMMER_RADIUS.sm} />
    <AppShimmer width="42%" height={moderateScale(11)} radius={SHIMMER_RADIUS.sm} />
  </AppShimmerCard>
);

const EMPTY_SOIL_VALUES: SoilValues = {
  texture: '',
  ph: '',
  organicMatter: '',
  nitrogen: '',
  phosphorus: '',
  potassium: '',
  moisture: '',
  testedOn: '',
  notes: '',
};

const NOT_RECORDED = 'Not recorded';

const numToText = (n: number | null): string => (n === null ? '' : String(n));

const textToNum = (text: string): number | null => {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  const n = Number.parseFloat(trimmed);
  return Number.isFinite(n) ? n : null;
};

const FieldDetailsScreen: React.FC<AppScreenProps<'FieldDetails'>> = ({
  route,
  navigation,
}) => {
  const { farmId, fieldId: initialFieldId } = route.params;
  const dispatch = useAppDispatch();

  const [selectedFieldId] = useState(initialFieldId);
  const [activeTab, setActiveTab] = useState<FieldTab>('overview');
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const farm = useAppSelector(selectSelectedFarm);
  const allFields = useAppSelector(selectFields);
  const fieldsLoading = useAppSelector(selectFieldsLoading);
  const fieldsError = useAppSelector(selectFieldsError);
  const fieldsFarmId = useAppSelector(selectFieldsFarmId);
  const fieldsReady = fieldsFarmId === farmId;

  useEffect(() => {
    if (farm?.id !== farmId) {
      dispatch(fetchFarmDetailThunk(farmId));
    }
    if (fieldsFarmId !== farmId) {
      dispatch(fetchFarmFieldsThunk(farmId));
    }
  }, [dispatch, farmId, farm, fieldsFarmId]);

  const currentField = useMemo(() => {
    const farmFields = fieldsReady ? allFields : [];
    return farmFields.find(f => f.id === selectedFieldId) || farmFields[0];
  }, [allFields, selectedFieldId, fieldsReady]);

  const goToEditField = useCallback(() => {
    if (!currentField) {
      return;
    }
    navigation.navigate('AddField', {
      farmId,
      fieldId: currentField.id,
      farmName: farm?.name,
    });
  }, [navigation, farmId, currentField, farm]);

  useBoundaryPersistence({ fieldId: currentField?.id ?? '', farmId });
  const boundaryRepository = useBoundaryRepository(farmId);

  const mapFocusRef = useRef<MapFocusHandle | null>(null);
  const focusMap = useCallback(() => mapFocusRef.current?.focus(), []);

  const refreshLiveField = useCallback(() => {
    dispatch(refreshFarmFieldsThunk(farmId));
    if (selectedFieldId) {
      dispatch(fetchFieldOverviewThunk(selectedFieldId));
    }
  }, [dispatch, farmId, selectedFieldId]);

  useSyncedFetch({
    tags: selectedFieldId
      ? [Tags.field(selectedFieldId), Tags.fields(farmId)]
      : [Tags.fields(farmId)],
    run: refreshLiveField,
    hasData: fieldsReady,
  });

  const boundary = useAppSelector(state =>
    currentField ? selectBoundary(state, currentField.id) : null,
  );

  const goToBoundaryEditor = useCallback(() => {
    if (!currentField) {
      return;
    }
    navigation.navigate('BoundaryEditor', {
      farmId,
      fieldId: currentField.id,
      fieldName: currentField.name,
      latitude: currentField.latitude,
      longitude: currentField.longitude,
    });
  }, [navigation, farmId, currentField]);

  const detailsFieldId = useAppSelector(selectFieldDetailsFieldId);
  const overview = useAppSelector(selectFieldOverview);
  const activity = useAppSelector(selectFieldActivity);
  const soil = useAppSelector(selectFieldSoil);
  const documents = useAppSelector(selectFieldDocuments);
  const tabLoading = useAppSelector(selectFieldTabLoading);
  const tabError = useAppSelector(selectFieldTabError);
  const uploadingDoc = useAppSelector(selectUploadingDoc);
  const deletingDocId = useAppSelector(selectDeletingDocId);

  useEffect(() => {
    if (selectedFieldId) {
      dispatch(setActiveField(selectedFieldId));
    }
  }, [dispatch, selectedFieldId]);

  useEffect(() => {
    if (!selectedFieldId || detailsFieldId !== selectedFieldId) {
      return;
    }
    if (activeTab === 'overview' && overview === null && !tabLoading.overview) {
      dispatch(fetchFieldOverviewThunk(selectedFieldId));
    } else if (activeTab === 'history' && activity === null && !tabLoading.activity) {
      dispatch(fetchFieldActivityThunk(selectedFieldId));
    } else if (activeTab === 'soil' && soil === null && !tabLoading.soil) {
      console.log('[FieldDetails] soil fetch', { fieldId: selectedFieldId });
      dispatch(fetchFieldSoilThunk(selectedFieldId));
    } else if (activeTab === 'documents' && documents === null && !tabLoading.documents) {
      dispatch(fetchFieldDocumentsThunk(selectedFieldId));
    }
  }, [
    dispatch,
    selectedFieldId,
    detailsFieldId,
    activeTab,
    overview,
    activity,
    soil,
    documents,
    tabLoading,
  ]);

  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      if (!selectedFieldId) {
        return;
      }
      dispatch(fetchFieldOverviewThunk(selectedFieldId));
      dispatch(fetchFieldSoilThunk(selectedFieldId));
    }, [dispatch, selectedFieldId]),
  );

  const docList = useMemo(() => documents ?? [], [documents]);
  const { entries: downloadEntries, download: startDownload } = useFileDownloads(docList);

  const imageDocs = useMemo(
    () => docList.filter(d => classifyMedia(d).type === 'image'),
    [docList],
  );
  const viewerImages = useMemo(
    () =>
      imageDocs.map(d => {
        const e = downloadEntries[d.id];
        const uri = e?.status === 'exists' && e.localPath ? toFileUri(e.localPath) : d.url;
        return { uri };
      }),
    [imageDocs, downloadEntries],
  );
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [mapPanning, setMapPanning] = useState(false);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoVisible, setVideoVisible] = useState(false);
  const [soilEditorVisible, setSoilEditorVisible] = useState(false);
  const [soilDraft, setSoilDraft] = useState<SoilValues>(EMPTY_SOIL_VALUES);
  const soilSaving = useAppSelector(selectSoilSaving);
  const soilRecord = useAppSelector(selectSoilRecord);
  const soilRecordFieldId = useAppSelector(selectSoilFieldId);
  const fieldResetting = useAppSelector(selectFieldResetting);
  const fieldDeleting = useAppSelector(selectFieldDeleting);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    if (!selectedFieldId) {
      return;
    }
    const reloadHistory = activeTab === 'history' || activity !== null;
    const reloadSoil = activeTab === 'soil' || soil !== null;
    const reloadSoilRecord = soilRecordFieldId === selectedFieldId;
    const reloadDocuments = activeTab === 'documents' || documents !== null;

    setRefreshing(true);
    try {
      await Promise.all([
        dispatch(refreshFarmDetailThunk(farmId)),
        dispatch(refreshFarmFieldsThunk(farmId)),
        dispatch(fetchFieldOverviewThunk(selectedFieldId)),
        boundaryRepository.load(selectedFieldId),
        reloadHistory && dispatch(fetchFieldActivityThunk(selectedFieldId)),
        reloadSoil && dispatch(fetchFieldSoilThunk(selectedFieldId)),
        reloadSoilRecord && dispatch(fetchFieldSoilRecordThunk(selectedFieldId)),
        reloadDocuments && dispatch(fetchFieldDocumentsThunk(selectedFieldId)),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    dispatch,
    farmId,
    selectedFieldId,
    boundaryRepository,
    activeTab,
    activity,
    soil,
    soilRecordFieldId,
    documents,
  ]);

  useEffect(() => {
    if (activeTab !== 'overview') {
      setMapPanning(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'soil' && soil && !soil.locked && soilRecordFieldId !== selectedFieldId) {
      dispatch(setSoilField(selectedFieldId));
      dispatch(fetchFieldSoilRecordThunk(selectedFieldId));
    }
  }, [activeTab, soil, soilRecordFieldId, selectedFieldId, dispatch]);

  const openSoilEditor = useCallback(() => {
    const r = soilRecordFieldId === selectedFieldId ? soilRecord : null;
    setSoilDraft(
      r
        ? {
            texture: r.texture,
            ph: numToText(r.ph),
            organicMatter: numToText(r.organicMatter),
            nitrogen: numToText(r.nitrogen),
            phosphorus: numToText(r.phosphorus),
            potassium: numToText(r.potassium),
            moisture: numToText(r.moisture),
            testedOn: r.testedOnISO ?? '',
            notes: r.notes,
          }
        : EMPTY_SOIL_VALUES,
    );
    setSoilEditorVisible(true);
  }, [soilRecord, soilRecordFieldId, selectedFieldId]);

  const handleSoilDraftChange = useCallback(
    (field: keyof SoilValues, value: string) =>
      setSoilDraft(prev => ({ ...prev, [field]: value })),
    [],
  );

  const handleSoilSave = useCallback(async () => {
    const input: SaveSoilInput = {
      texture: soilDraft.texture.trim() || null,
      notes: soilDraft.notes.trim() || null,
      testedOn: soilDraft.testedOn.trim() || null,
      ...(soil?.locked
        ? {}
        : {
            ph: textToNum(soilDraft.ph),
            organicMatter: textToNum(soilDraft.organicMatter),
            nitrogen: textToNum(soilDraft.nitrogen),
            phosphorus: textToNum(soilDraft.phosphorus),
            potassium: textToNum(soilDraft.potassium),
            moisture: textToNum(soilDraft.moisture),
          }),
    };
    const action = await dispatch(
      saveFieldSoilThunk({ fieldId: selectedFieldId, input }),
    );
    if (saveFieldSoilThunk.fulfilled.match(action)) {
      setSoilEditorVisible(false);
      showSuccess('Soil details saved');
      dispatch(fetchFieldSoilThunk(selectedFieldId));
    }
  }, [dispatch, selectedFieldId, soilDraft, soil?.locked]);

  const askResetField = useCallback(() => setPendingAction('reset'), []);
  const askDeleteField = useCallback(() => setPendingAction('delete'), []);
  const dismissDialog = useCallback(() => setPendingAction(null), []);

  const runResetField = useCallback(async () => {
    const action = await dispatch(
      resetFieldThunk({ farmId, fieldId: selectedFieldId }),
    );
    setPendingAction(null);
    if (resetFieldThunk.fulfilled.match(action)) {
      showSuccess('Field reset');
      dispatch(fetchFieldOverviewThunk(selectedFieldId));
    }
  }, [dispatch, farmId, selectedFieldId]);

  const runDeleteField = useCallback(async () => {
    const action = await dispatch(
      deleteFieldThunk({ farmId, fieldId: selectedFieldId }),
    );
    setPendingAction(null);
    if (deleteFieldThunk.fulfilled.match(action)) {
      showSuccess('Field deleted');
      navigation.goBack();
    }
  }, [dispatch, farmId, selectedFieldId, navigation]);

  const menuItems = useMemo<OverflowMenuItem[]>(
    () => [
      {
        key: 'edit',
        icon: 'pencil-outline',
        title: 'Edit Field',
        onPress: goToEditField,
      },
      {
        key: 'reset',
        icon: 'backup-restore',
        title: 'Reset Field',
        onPress: askResetField,
        loading: fieldResetting,
      },
      {
        key: 'delete',
        icon: 'trash-can-outline',
        title: 'Delete Field',
        onPress: askDeleteField,
        destructive: true,
        loading: fieldDeleting,
      },
    ],
    [goToEditField, askResetField, askDeleteField, fieldResetting, fieldDeleting],
  );

  const openDocument = useCallback(
    (doc: FieldDocument, previewUri: string) => {
      const type = classifyMedia(doc).type;
      if (type === 'image') {
        const idx = imageDocs.findIndex(d => d.id === doc.id);
        if (idx >= 0) {
          setImageViewerIndex(idx);
          setImageViewerVisible(true);
          return;
        }
      }
      if (type === 'video') {
        setVideoUri(previewUri);
        setVideoVisible(true);
        return;
      }

      Linking.openURL(doc.url).catch(() =>
        showToast('Could not open this document.', { type: 'error' }),
      );
    },
    [imageDocs],
  );

  const confirmDeleteDocument = useCallback(
    (doc: FieldDocument) => {
      Alert.alert('Delete document', `Remove "${doc.name}"? This can't be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            dispatch(
              deleteFieldDocumentThunk({ fieldId: selectedFieldId, documentId: doc.id }),
            ),
        },
      ]);
    },
    [dispatch, selectedFieldId],
  );

  const handleUploadDocument = useCallback(async () => {
    let picked;
    try {
      picked = await pickDocument();
    } catch {
      showToast('Could not open the file picker.', { type: 'error' });
      return;
    }
    if (!picked) {
      return;
    }
    const displayName = picked.name.replace(/\.[^./\\]+$/, '') || picked.name;
    const action = await dispatch(
      uploadFieldDocumentThunk({
        fieldId: selectedFieldId,
        file: { uri: picked.uri, name: picked.name, mime: picked.mime },
        name: displayName,
      }),
    );
    if (uploadFieldDocumentThunk.fulfilled.match(action)) {
      showSuccess('Document uploaded');
    }
  }, [dispatch, selectedFieldId]);

  const handleDownloadDoc = useCallback(
    async (doc: FieldDocument) => {
      const ok = await startDownload(doc);
      if (ok) {
        showSuccess('Saved to your device');
      } else {
        showToast('Download failed. Please try again.', { type: 'error' });
      }
    },
    [startDownload],
  );

  const handleShareDoc = useCallback(async (doc: FieldDocument) => {
    try {
      await Share.share({ message: `${doc.name}\n${doc.url}`, url: doc.url, title: doc.name });
    } catch {
      showToast('Could not share this file.', { type: 'error' });
    }
  }, []);

  if (!fieldsReady || (fieldsLoading && allFields.length === 0)) {
    return (
      <View style={styles.safe}>
        <AppHeader variant="back" title="Field Details" onBack={() => navigation.goBack()} />
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.mapContainer}>
            <View style={styles.heroTopRow}>
              <View style={styles.flex}>
                <AppShimmer width="60%" height={moderateScale(20)} radius={SHIMMER_RADIUS.sm} />
                <AppShimmer
                  width="45%"
                  height={moderateScale(13)}
                  radius={SHIMMER_RADIUS.sm}
                  style={skStyles.heroSubGap}
                />
              </View>
              <AppShimmerCircle size={scale(24)} />
            </View>

            <View style={styles.filterBar}>
              <AppShimmer width="100%" height={scale(40)} radius={SHIMMER_RADIUS.lg} />
            </View>

            <AppShimmerImage height={scale(240)} radius={SHIMMER_RADIUS.lg} />
          </View>

          <View style={[styles.chipScroll, shimmerLayout.rowStart]}>
            <AppShimmerChip width={scale(96)} height={scale(42)} />
            <AppShimmerChip width={scale(96)} height={scale(42)} />
            <AppShimmerChip width={scale(96)} height={scale(42)} />
          </View>

          <View style={styles.tabBodyContainer}>
            <AppShimmerSection titleWidth={scale(140)}>
              <View style={styles.statsGrid}>
                <View style={styles.statsCell}>
                  <StatTileShimmer />
                </View>
                <View style={styles.statsCell}>
                  <StatTileShimmer />
                </View>
                <View style={styles.statsCell}>
                  <StatTileShimmer />
                </View>
                <View style={styles.statsCell}>
                  <StatTileShimmer />
                </View>
              </View>
            </AppShimmerSection>

            <View style={skStyles.sectionGap} />

            <AppShimmerCard>
              <AppShimmerText count={4} spacing={spacing[3]} lastLineWidth="70%" />
            </AppShimmerCard>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (fieldsError && allFields.length === 0) {
    return (
      <View style={styles.safe}>
        <AppHeader variant="back" title="Field Details" onBack={() => navigation.goBack()} />
        <View style={styles.stateCenter}>
          <AppIcon name={ICONS.ERROR} size={moderateScale(48)} color={COLORS.gray500} />
          <AppText style={styles.stateTitle}>Couldn't load fields</AppText>
          <AppText style={styles.stateMessage}>{fieldsError}</AppText>
          <Button
            title="Retry"
            onPress={() => dispatch(fetchFarmFieldsThunk(farmId))}
            fullWidth={false}
            style={styles.stateRetry}
          />
        </View>
      </View>
    );
  }

  if (!currentField) {
    return (
      <View style={styles.safe}>
        <AppHeader variant="back" title="Field Details" onBack={() => navigation.goBack()} />
        <EmptyState icon="sprout-outline" title="No fields yet" message="This farm has no fields." />
      </View>
    );
  }

  const renderTabLoading = () => (
    <View style={styles.tabLoadingBox}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );

  const renderTabError = (message: string, onRetry: () => void) => (
    <View style={styles.tabErrorBox}>
      <AppIcon name={ICONS.ERROR} size={moderateScale(36)} color={COLORS.gray500} />
      <AppText style={styles.tabErrorText}>{message}</AppText>
      <TouchableOpacity onPress={onRetry} hitSlop={DOC_HITSLOP}>
        <AppText style={styles.retryText}>Retry</AppText>
      </TouchableOpacity>
    </View>
  );

  const renderOverview = () => {
    if (!overview && tabLoading.overview) {
      return renderTabLoading();
    }
    if (!overview && tabError.overview) {
      return renderTabError(tabError.overview, () =>
        dispatch(fetchFieldOverviewThunk(selectedFieldId)),
      );
    }
    const o = overview;
    const infoRows = o
      ? [
          { label: 'Farm', value: o.farmName || '—' },
          { label: 'Crop', value: o.crop || '—' },
          { label: 'Season', value: o.season || '—' },
        ]
      : [];
    const locationText = o?.location || currentField.coordinates;

    return (
      <View style={styles.tabAnimateWrap}>
        <View
          style={[styles.mapBox, skStyles.overviewMap]}
          onStartShouldSetResponderCapture={() => {
            setMapPanning(true);
            return false;
          }}
          onTouchEnd={() => setMapPanning(false)}
          onTouchCancel={() => setMapPanning(false)}>
          {boundary ? (
            <BoundaryPreviewMap
              ref={mapFocusRef}
              ring={boundary.ring}
              center={boundary.center}
              onTouchStart={() => setMapPanning(true)}
              onTouchEnd={() => setMapPanning(false)}
              onTouchCancel={() => setMapPanning(false)}
            />
          ) : currentField.latitude != null && currentField.longitude != null ? (
            <FieldLocationPreview
              ref={mapFocusRef}
              latitude={currentField.latitude}
              longitude={currentField.longitude}
              onTouchStart={() => setMapPanning(true)}
              onTouchEnd={() => setMapPanning(false)}
              onTouchCancel={() => setMapPanning(false)}
            />
          ) : (
            <View style={styles.mapEmpty}>
              <AppIcon name={ICONS.LOCATION} size={moderateScale(28)} color={COLORS.gray300} />
              <AppText style={styles.mapEmptyText}>Location not set for this field</AppText>
            </View>
          )}

          <View style={styles.mapActions}>
            {boundary || (currentField.latitude != null && currentField.longitude != null) ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={focusMap}
                hitSlop={MAP_BUTTON_HIT_SLOP}
                style={styles.mapFocusBtn}
                accessibilityRole="button"
                accessibilityLabel={
                  boundary ? 'Show the whole field on the map' : 'Show the field location on the map'
                }>
                <AppIcon
                  name={ICONS.FOCUS_FIELD}
                  size={moderateScale(20)}
                  color={COLORS.primaryDark}
                />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={goToBoundaryEditor}
              style={[styles.mapFab, boundary ? styles.mapFabEdit : styles.mapFabAdd]}
              accessibilityRole="button"
              accessibilityLabel={boundary ? 'Edit field boundary' : 'Add field boundary'}>
              <AppIcon
                name={boundary ? 'pencil' : 'vector-polygon'}
                size={moderateScale(15)}
                color={COLORS.white}
              />
              <AppText style={styles.mapFabText}>{boundary ? 'Edit' : 'Add boundary'}</AppText>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.overviewHero}>
          <View style={styles.heroTopRow}>
            <View style={styles.flex}>
              <AppText style={styles.heroTitle}>{o?.name ?? currentField.name}</AppText>
              <AppText style={styles.heroSub}>
                {o?.crop ?? currentField.crop} · {o?.season ?? currentField.season}
              </AppText>
            </View>
          </View>

          {locationText ? (
            <View style={styles.heroCoordsRow}>
              <AppIcon name={ICONS.LOCATION} size={moderateScale(16)} color={COLORS.gray500} />
              <AppText style={styles.heroCoordsText}>{locationText}</AppText>
            </View>
          ) : null}
        </View>

        <SectionHeader title="Operational Stats" />
        <View style={styles.statsGrid}>
          <View style={styles.statsCell}>
            <StatCard icon="vector-square" label="Area" value={`${formatAcres(o?.areaAcres ?? currentField.areaAcres)} ac`} tone="neutral" />
          </View>
          <View style={styles.statsCell}>
            <StatCard icon="water-outline" label="Irrigation" value={o?.irrigation || currentField.irrigation || '—'} tone="info" />
          </View>
          <View style={styles.statsCell}>
            <StatCard icon="calendar-outline" label="Planting Month" value={formatMonth(o?.sowingDateISO ?? currentField.sowingDateISO)} tone="neutral" />
          </View>
          <View style={styles.statsCell}>
            <StatCard icon="calendar-check-outline" label="Harvest Month" value={formatMonth(o?.expectedHarvestISO ?? currentField.expectedHarvestISO)} tone="success" />
          </View>
        </View>

        {infoRows.length > 0 ? (
          <View style={styles.card}>
            {infoRows.map((row, i) => (
              <View
                key={row.label}
                style={[styles.infoRow, i < infoRows.length - 1 && styles.infoDivider]}>
                <AppText style={styles.infoLabel}>{row.label}</AppText>
                <AppText style={styles.infoValue} numberOfLines={1}>{row.value}</AppText>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  const renderHistory = () => {
    if (!activity && tabLoading.activity) {
      return renderTabLoading();
    }
    if (!activity && tabError.activity) {
      return renderTabError(tabError.activity, () =>
        dispatch(fetchFieldActivityThunk(selectedFieldId)),
      );
    }
    return (
      <View style={styles.tabAnimateWrap}>
        {activity && activity.length > 0 ? (
          <View style={styles.card}>
            <Timeline items={activity} />
          </View>
        ) : (
          <AppText style={styles.emptyText}>
            No recent activity logged for this field yet.
          </AppText>
        )}
      </View>
    );
  };

  const renderSoil = () => {
    console.log('[FieldDetails] soil render', {
      fieldId: selectedFieldId,
      locked: soil?.locked,
      metricsCount: soil?.metrics.length ?? 0,
      texture: soil?.texture,
      testedOnISO: soil?.testedOnISO,
      notes: soil?.notes,
      loading: tabLoading.soil,
      error: tabError.soil,
      raw: soil,
    });

    if (!soil && tabLoading.soil) {
      return renderTabLoading();
    }
    if (!soil && tabError.soil) {
      return renderTabError(tabError.soil, () =>
        dispatch(fetchFieldSoilThunk(selectedFieldId)),
      );
    }
    const s = soil;
    if (!s) {
      return (
        <View style={styles.tabAnimateWrap}>
          <AppText style={styles.emptyText}>
            No soil test recorded for this field yet.
          </AppText>
        </View>
      );
    }
    return (
      <View style={styles.tabAnimateWrap}>
        {s.locked ? (
          <View style={styles.soilLockCard}>
            <View style={styles.soilLockIcon}>
              <AppIcon name="lock-outline" size={moderateScale(18)} color={COLORS.warning} />
            </View>
            <View style={styles.soilLockTexts}>
              <AppText style={styles.soilLockTitle}>Nutrient details locked</AppText>
              <AppText style={styles.soilLockText}>
                Enroll this field in a program to record pH, organic matter, N-P-K and
                moisture.
              </AppText>
            </View>
          </View>
        ) : (
          <Button
            title={s.metrics.length > 0 ? 'Edit Soil Details' : 'Add Soil Details'}
            variant="outline"
            onPress={openSoilEditor}
            leftIcon={
              <AppIcon name={ICONS.EDIT} size={moderateScale(18)} color={COLORS.primary} />
            }
          />
        )}
        {s.metrics.length > 0 ? (
          <>
            <SectionHeader title="Lab & Sensor Metrics" />
            <View style={styles.statsGrid}>
              {s.metrics.map(item => (
                <View key={item.id} style={styles.statsCell}>
                  <StatCard icon={item.icon} label={item.label} value={item.value} tone={item.tone} />
                </View>
              ))}
            </View>
          </>
        ) : !s.locked ? (
          <View style={styles.card}>
            <AppText style={styles.emptyText}>
              No nutrient readings yet. Use Add Soil Details to record pH, organic
              matter, N-P-K and moisture.
            </AppText>
          </View>
        ) : null}

        <SectionHeader title="Soil Profile" />
        <View style={styles.card}>
          <InfoRow
            label="Soil Texture"
            value={s.texture || NOT_RECORDED}
            icon={ICONS.HARVEST}
          />
          <InfoRow
            label="Soil Tested On"
            value={s.testedOnISO ? formatDate(s.testedOnISO) : NOT_RECORDED}
            icon={ICONS.CALENDAR}
          />
          <InfoRow
            label="Soil Notes"
            value={s.notes || NOT_RECORDED}
            icon={ICONS.NOTE}
            last
          />
        </View>
      </View>
    );
  };

  const renderDocuments = () => {
    if (!documents && tabLoading.documents) {
      return renderTabLoading();
    }
    if (!documents && tabError.documents) {
      return renderTabError(tabError.documents, () =>
        dispatch(fetchFieldDocumentsThunk(selectedFieldId)),
      );
    }
    const docs = documents ?? [];
    return (
      <View style={styles.tabAnimateWrap}>
        <Button
          title="Upload Document"
          onPress={handleUploadDocument}
          loading={uploadingDoc}
          variant="outline"
          leftIcon={<AppIcon name={ICONS.UPLOAD} size={moderateScale(18)} color={COLORS.primary} />}
        />

        {docs.length === 0 ? (
          <AppText style={styles.emptyText}>
            No documents uploaded for this field yet.
          </AppText>
        ) : (
          <View style={styles.docsList}>
            {docs.map(doc => (
              <AttachmentCard
                key={doc.id}
                doc={doc}
                entry={downloadEntries[doc.id]}
                deleting={deletingDocId === doc.id}
                onPreview={openDocument}
                onDownload={handleDownloadDoc}
                onDelete={confirmDeleteDocument}
                onShare={handleShareDoc}
              />
            ))}
          </View>
        )}
      </View>
    );
  };
  return (
    <View style={styles.safe}>
      <AppHeader
        variant="back"
        title={farm ? `${farm.name} Fields` : 'Field Details'}
        onBack={() => navigation.goBack()}
        rightActions={null}
        rightComponent={
          <AppOverflowMenu items={menuItems} accessibilityLabel="Field actions" />
        }
      />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!mapPanning}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            enabled={!mapPanning}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }>
        <View style={styles.mapContainer}>
          <View style={styles.heroTopRow}>
            <View style={styles.flex}>
              <AppText style={styles.heroTitle}>{currentField.name}</AppText>
              <AppText style={styles.heroSub}>
                {currentField.crop} · {currentField.season}
              </AppText>
            </View>
          </View>

          <View style={[styles.filterBar, skStyles.filterBarLast]}>
            <AnimatedTabBar
              tabs={FILTER_TABS}
              activeKey={activeTab}
              onTabChange={setActiveTab}
              scrollable
            />
          </View>
        </View>

        <View style={styles.tabBodyContainer}>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'history' && renderHistory()}
          {activeTab === 'soil' && renderSoil()}
          {activeTab === 'documents' && renderDocuments()}
          {/* {activeTab === 'monitoring' && (
            <MonitoringModulesView
              farmId={farmId}
              fieldId={selectedFieldId}
              fieldName={currentField.name}
              fieldSubtitle={currentField.crop}
              hasBoundary={!!boundary || currentField.hasBoundary === true}
              onDrawBoundary={goToBoundaryEditor}
              navigation={navigation}
            />
          )} */}
        </View>

      </ScrollView>

      {viewerImages.length > 0 ? (
        <AppImageViewer
          images={viewerImages}
          imageIndex={Math.min(imageViewerIndex, viewerImages.length - 1)}
          visible={imageViewerVisible}
          onRequestClose={() => setImageViewerVisible(false)}
        />
      ) : null}

      <AppVideoViewer
        uri={videoUri}
        visible={videoVisible}
        onRequestClose={() => setVideoVisible(false)}
      />

      <ConfirmationModal
        visible={pendingAction === 'reset'}
        icon="backup-restore"
        title="Reset this field?"
        message="Resetting clears the field's recorded details so you can start over. The field itself stays on the farm."
        consequences={['Crop, season and area details', 'Irrigation and location data']}
        retains={['The field name', 'Its assessments', 'Soil records and documents']}
        confirmLabel="Reset Field"
        loading={fieldResetting}
        onConfirm={runResetField}
        onCancel={dismissDialog}
      />

      <ConfirmationModal
        visible={pendingAction === 'delete'}
        tone="danger"
        icon="trash-can-outline"
        title="Delete this field?"
        message={`"${currentField.name}" and everything recorded against it will be removed. This cannot be undone.`}
        consequences={[
          'The field and all of its details',
          'Its soil record and uploaded documents',
          'Its assessment history',
          'Its link to any program enrolment',
        ]}
        confirmLabel="Delete Field"
        loading={fieldDeleting}
        onConfirm={runDeleteField}
        onCancel={dismissDialog}
      />

      <SoilDetailsModal
        visible={soilEditorVisible}
        onClose={() => setSoilEditorVisible(false)}
        values={soilDraft}
        onChange={handleSoilDraftChange}
        showNutrients={!soil?.locked}
        onSubmit={handleSoilSave}
        submitLabel="Save Soil Details"
        submitting={soilSaving}
        subtitle="Recorded against this field's soil test"
      />
    </View>
  );
};

export default FieldDetailsScreen;

const skStyles = StyleSheet.create({
  statTile: {
    gap: spacing[1],
  },
  heroSubGap: {
    marginTop: scale(6),
  },
  sectionGap: {
    height: spacing[4],
  },
  filterBarLast: {
    marginBottom: 0,
  },
  overviewMap: {
    marginBottom: spacing[4],
  },
});


 