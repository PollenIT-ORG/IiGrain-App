import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import AppImageViewer from '../../components/AppImageViewer/AppImageViewer';
import AppVideoViewer from '../../components/AppVideoViewer/AppVideoViewer';
import { AppIcon, ICONS } from '../../components/AppIcon';
import { AppHeader, AppText, Button } from '../../components';
import type { HeaderAction } from '../../components';
import {
  EmptyState,
  SectionHeader,
  StatCard,
  StatusBadge,
  Timeline,
} from '../../components/farms';
import { COLORS, spacing } from '../../constants';
import { addAlpha, capitalize, formatDate, formatNumber, moderateScale, scale } from '../../utils';
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
import { FIELD_HEALTH_META } from '../../types/farm';
import type { AppScreenProps } from '../../navigation/navigationTypes';
import { styles } from './FieldDetailsScreenStyle';
import { AnimatedTabBar } from '../../components/';
import FieldChips from '../../components/farms/FieldChips';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  fetchFarmFieldsThunk,
  selectFields,
  selectFieldsError,
  selectFieldsFarmId,
  selectFieldsLoading,
} from '../../redux/slices/fieldSlice';
import {
  fetchFarmDetailThunk,
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
import { pickDocument } from '../../services/documentPickerService';
import type { FieldDocument } from '../../types/fieldDetails';
import { AttachmentCard } from '../../components/media';
import { useFileDownloads } from '../../hooks/useFileDownloads';
import { toFileUri } from '../../services/fileDownloadService';
import { classifyMedia } from '../../utils/fileType';

type FieldTab = 'overview' | 'history' | 'soil' | 'documents';

const FILTER_TABS: { key: FieldTab; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'view-dashboard-outline' },
  { key: 'history', label: 'History', icon: 'history' },
  { key: 'soil', label: 'Soil', icon: 'layers-outline' },
  { key: 'documents', label: 'Docs', icon: 'file-document-outline' },
];

const PALETTE = [COLORS.accent, COLORS.info, COLORS.secondary, COLORS.primary];

const DOC_HITSLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

const StatTileShimmer: React.FC = () => (
  <AppShimmerCard style={skStyles.statTile}>
    <AppShimmerCircle size={scale(36)} />
    <AppShimmer width="55%" height={moderateScale(16)} radius={SHIMMER_RADIUS.sm} />
    <AppShimmer width="42%" height={moderateScale(11)} radius={SHIMMER_RADIUS.sm} />
  </AppShimmerCard>
);

const MAP_POSITIONS: ViewStyle[] = [
  { top: '6%', left: '5%', width: '44%', height: '50%' },
  { top: '9%', left: '52%', width: '43%', height: '40%' },
  { top: '58%', left: '6%', width: '41%', height: '36%' },
  { top: '45%', left: '50%', width: '45%', height: '49%' },
];

const FieldDetailsScreen: React.FC<AppScreenProps<'FieldDetails'>> = ({
  route,
  navigation,
}) => {
  const { farmId, fieldId: initialFieldId } = route.params;
  const dispatch = useAppDispatch();

  const [selectedFieldId, setSelectedFieldId] = useState(initialFieldId);
  const [activeTab, setActiveTab] = useState<FieldTab>('overview');

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

  const handleHeaderAction = useCallback(
    (action: HeaderAction) => {
      if (action === 'edit' && currentField) {
        navigation.navigate('AddField', {
          farmId,
          fieldId: currentField.id,
          farmName: farm?.name,
        });
      }
    },
    [navigation, farmId, currentField, farm],
  );

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
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoVisible, setVideoVisible] = useState(false);

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

  const healthMeta = FIELD_HEALTH_META[currentField.status];

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
          { label: 'Farm', value: o.farmName || '-' },
          { label: 'Crop', value: o.crop || '-' },
          { label: 'Season', value: o.season || '-' },
          { label: 'Status', value: capitalize(o.status) },
        ]
      : [];
    const locationText = o?.location || currentField.coordinates;

    return (
      <View style={styles.tabAnimateWrap}>
        <View style={styles.overviewHero}>
          <View style={styles.heroTopRow}>
            <View style={styles.flex}>
              <AppText style={styles.heroTitle}>{o?.name ?? currentField.name}</AppText>
              <AppText style={styles.heroSub}>
                {o?.crop ?? currentField.crop} · {o?.season ?? currentField.season}
              </AppText>
            </View>
            <StatusBadge label={healthMeta.label} tone={healthMeta.tone} />
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
            <StatCard icon="vector-square" label="Area" value={`${formatNumber(o?.areaAcres ?? currentField.areaAcres)} ac`} tone="neutral" />
          </View>
          <View style={styles.statsCell}>
            <StatCard icon="water-outline" label="Irrigation" value={o?.irrigation || currentField.irrigation || '-'} tone="info" />
          </View>
          <View style={styles.statsCell}>
            <StatCard icon="calendar-outline" label="Sown Date" value={formatDate(o?.sowingDateISO ?? currentField.sowingDateISO)} tone="neutral" />
          </View>
          <View style={styles.statsCell}>
            <StatCard icon="calendar-check-outline" label="Harvest Est." value={formatDate(o?.expectedHarvestISO ?? currentField.expectedHarvestISO)} tone="success" />
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
    if (!soil && tabLoading.soil) {
      return renderTabLoading();
    }
    if (!soil && tabError.soil) {
      return renderTabError(tabError.soil, () =>
        dispatch(fetchFieldSoilThunk(selectedFieldId)),
      );
    }
    const s = soil;
    if (!s || s.metrics.length === 0) {
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
        <SectionHeader title="Lab & Sensor Metrics" />
        <View style={styles.statsGrid}>
          {s.metrics.map(item => (
            <View key={item.id} style={styles.statsCell}>
              <StatCard icon={item.icon} label={item.label} value={item.value} tone={item.tone} />
            </View>
          ))}
        </View>
        {s.texture || s.testedOnISO || s.notes ? (
          <View style={styles.card}>
            <View style={styles.soilFootnote}>
              {s.texture ? (
                <View style={styles.soilNoteRow}>
                  <AppIcon name={ICONS.HARVEST} size={moderateScale(15)} color={COLORS.gray500} />
                  <AppText style={styles.soilNoteText}>Texture: {s.texture}</AppText>
                </View>
              ) : null}
              {s.testedOnISO ? (
                <View style={styles.soilNoteRow}>
                  <AppIcon name={ICONS.CALENDAR} size={moderateScale(15)} color={COLORS.gray500} />
                  <AppText style={styles.soilNoteText}>Tested on {formatDate(s.testedOnISO)}</AppText>
                </View>
              ) : null}
              {s.notes ? (
                <View style={styles.soilNoteRow}>
                  <AppIcon name={ICONS.NOTE} size={moderateScale(15)} color={COLORS.gray500} />
                  <AppText style={styles.soilNoteText}>{s.notes}</AppText>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
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
  const isWhite = true;
  const iconColor = isWhite ? COLORS.primary : COLORS.white;

  return (
    <View style={styles.safe}>
      <AppHeader
        variant="back"
        title={farm ? `${farm.name} Fields` : 'Field Details'}
        onBack={() => navigation.goBack()}
        onActionPress={handleHeaderAction}
      />

      <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View style={styles.mapContainer}>

     <View style={styles.heroTopRow}>
          <View style={styles.flex}>
            <AppText style={styles.heroTitle}>{currentField.name}</AppText>
            <AppText style={styles.heroSub}>
              {currentField.crop} · {currentField.season}
            </AppText>
          </View>
          <Pressable onPress={() => handleHeaderAction('edit')}>
            <AppIcon name={ICONS.EDIT} size={moderateScale(20)} color={iconColor} />
          </Pressable>

        </View>

        <View style={styles.filterBar}>

<AnimatedTabBar
  tabs={FILTER_TABS}
  activeKey={activeTab}
  onTabChange={setActiveTab}
/>

        </View>

          <View style={styles.mapBox}>
            <View style={styles.backdrop}>
              <View style={styles.blobA} />
              <View style={styles.blobB} />
              <View style={styles.roadA} />
              <View style={styles.roadB} />
            </View>

            {allFields.map((fItem, idx) => {
              const isSelected = fItem.id === selectedFieldId;
              const parcelColor = PALETTE[idx % PALETTE.length];
              return (
                <Pressable
                  key={fItem.id}
                  onPress={() => setSelectedFieldId(fItem.id)}
                  style={({ pressed }) => [
                    styles.parcel,
                    MAP_POSITIONS[idx % MAP_POSITIONS.length],
                    { backgroundColor: addAlpha(parcelColor, isSelected ? 0.45 : 0.25), borderColor: parcelColor },
                    isSelected && styles.parcelSelected,
                    pressed && styles.parcelPressed,
                  ]}>
                  <View style={[styles.marker, { borderColor: parcelColor }]}>
                    <AppText style={styles.markerText} color={parcelColor}>{idx + 1}</AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

 <FieldChips
      fields={allFields}
      selectedId={selectedFieldId}
      onSelect={setSelectedFieldId}
    />

        <View style={styles.tabBodyContainer}>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'history' && renderHistory()}
          {activeTab === 'soil' && renderSoil()}
          {activeTab === 'documents' && renderDocuments()}
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
});
