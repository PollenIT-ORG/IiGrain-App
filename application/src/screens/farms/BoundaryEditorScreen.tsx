import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../../components/AppIcon';
import AppText from '../../components/AppText/AppText';
import { COLORS, spacing } from '../../constants';
import { moderateScale, scale } from '../../utils';
import { showToast } from '../../services/toastService';
import {
  ensureLocationPermission,
  getCurrentLocation,
} from '../../services/currentLocation';
import { useAppSelector } from '../../redux/hooks';
import { selectFields } from '../../redux/slices/fieldSlice';
import { selectSelectedFarm } from '../../redux/slices/farmSlice';
import type { AppScreenProps } from '../../navigation/navigationTypes';
import {
  AppMapView,
  MapKindSwitch,
  MapPlaceSearch,
  MapPolyline,
  MAP_ZOOM,
  useMapCamera,
  type LatLng,
  type MapKind,
  type MapRegion,
} from '../../maps';
import {
  BoundaryPointsPanel,
  BoundaryPolygon,
  BoundaryToolbar,
  MapActionRail,
  MidpointHandle,
  NudgePad,
  VertexMarker,
  useBoundaryEditor,
  useBoundaryPersistence,
  BOUNDARY_HINTS,
  MIN_VERTICES,
  type BoundaryStatusTone,
} from '../../maps/boundary';
import { type AreaUnit } from '../../maps/utils/geo';
import type { Place } from '../../services/geocoding';
import { styles } from './BoundaryEditorScreenStyle';

const SEARCH_ROW_H = scale(54);
const TITLE_ROW_H = scale(52);

const BoundaryEditorScreen: React.FC<AppScreenProps<'BoundaryEditor'>> = ({
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { farmId, fieldId, fieldName } = route.params;

  const fields = useAppSelector(selectFields);
  const selectedFarm = useAppSelector(selectSelectedFarm);
  const field = useMemo(() => fields.find(f => f.id === fieldId) ?? null, [fields, fieldId]);
  const orgId = selectedFarm?.id === farmId ? selectedFarm.orgId ?? null : null;

  const { mapRef, onMapReady, isReady, camera } = useMapCamera();
  const editor = useBoundaryEditor({ camera });
  const { draft, scale: mapScale } = editor;
  const persistence = useBoundaryPersistence({ fieldId, farmId, orgId });

  const [mapKind, setMapKind] = useState<MapKind>('satellite');
  const [unit, setUnit] = useState<AreaUnit>('acre');
  const [locating, setLocating] = useState(false);

  const fieldCenter = useMemo<LatLng | null>(
    () =>
      field?.latitude != null && field?.longitude != null
        ? { latitude: field.latitude, longitude: field.longitude }
        : null,
    [field],
  );

  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current || !isReady || persistence.hydrating) {
      return;
    }
    loadedRef.current = true;
    if (persistence.saved) {
      draft.load(persistence.saved.ring);
      camera.fitToCoordinates(persistence.saved.ring);
    } else if (fieldCenter) {
      camera.animateToCoordinate(fieldCenter, 18);
    }
  }, [isReady, persistence.hydrating, persistence.saved, fieldCenter, draft, camera]);

  const rejectionSeqRef = useRef(0);
  useEffect(() => {
    const rejection = draft.rejection;
    if (!rejection || rejection.seq === rejectionSeqRef.current) {
      return;
    }
    rejectionSeqRef.current = rejection.seq;
    showToast(rejection.message, { type: 'warning' });
    draft.clearRejection();
  }, [draft.rejection, draft.clearRejection]);

  const onRegionChange = useCallback(
    (region: MapRegion) => mapScale.onRegionChange(region),
    [mapScale],
  );

  const startDraw = useCallback(() => {
    draft.reset();
    editor.setMode('draw');
    showToast(BOUNDARY_HINTS.drawEmpty, { type: 'info' });
  }, [draft, editor]);

  const startEdit = useCallback(() => {
    editor.setMode('edit');
    editor.fitToBoundary();
  }, [editor]);

  const finishDrawing = useCallback(() => {
    draft.close();
    editor.setMode('edit');
    editor.fitToBoundary();
    showToast('Shape closed. Drag a point or an orange dot to refine it.', {
      type: 'success',
    });
  }, [draft, editor]);

  const goToMyLocation = useCallback(async () => {
    setLocating(true);
    try {
      const ok = await ensureLocationPermission();
      if (!ok) {
        showToast('Location permission is needed to centre the map on you.', {
          type: 'error',
        });
        return;
      }
      const fix = await getCurrentLocation();
      camera.animateToCoordinate(
        { latitude: fix.latitude, longitude: fix.longitude },
        19,
      );
    } catch {
      showToast('Could not get your location. Try again in the open.', {
        type: 'error',
      });
    } finally {
      setLocating(false);
    }
  }, [camera]);

  const addPointAtMyLocation = useCallback(async () => {
    setLocating(true);
    try {
      const ok = await ensureLocationPermission();
      if (!ok) {
        showToast('Location permission is needed to drop a point where you stand.', {
          type: 'error',
        });
        return;
      }
      const fix = await getCurrentLocation();
      const point: LatLng = { latitude: fix.latitude, longitude: fix.longitude };
      draft.addVertex(point);
      camera.animateToCoordinate(point, 19);
    } catch {
      showToast('Could not get your location. Try again in the open.', {
        type: 'error',
      });
    } finally {
      setLocating(false);
    }
  }, [draft, camera]);

  const goToPlace = useCallback(
    (place: Place) => {
      camera.animateToCoordinate(
        { latitude: place.latitude, longitude: place.longitude },
        MAP_ZOOM.PLACE,
      );
    },
    [camera],
  );

  const focusPointAt = useCallback(
    (index: number) => {
      const vertex = draft.vertices[index];
      if (!vertex) {
        return;
      }
      draft.select(vertex.id);
      camera.animateToCoordinate(vertex, 19);
    },
    [draft, camera],
  );

  const save = useCallback(async () => {
    if (!draft.canSave) {
      return;
    }
    try {
      const stored = await persistence.save(draft.ring);
      draft.load(stored.ring);
      editor.setMode('view');
      showToast('Boundary saved.', { type: 'success' });
    } catch {
      showToast('Saved on this device, but could not upload. It will sync on the next save.', {
        type: 'error',
      });
    }
  }, [draft, persistence, editor]);

  const deleteBoundary = useCallback(() => {
    Alert.alert(
      'Delete boundary?',
      'This removes the drawn field boundary. You can draw it again anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            persistence.remove().catch(() => {});
            draft.reset();
            editor.setMode('view');
            showToast('Boundary deleted.', { type: 'info' });
          },
        },
      ],
    );
  }, [persistence, draft, editor]);

  const isDirty = editor.isPlacing && (draft.vertexCount > 0 || draft.canUndo);

  const cancelEditing = useCallback(() => {
    const toView = () => {
      if (persistence.saved) {
        draft.load(persistence.saved.ring);
      } else {
        draft.reset();
      }
      editor.setMode('view');
    };
    if (!isDirty) {
      toView();
      return;
    }
    Alert.alert('Discard changes?', 'Your unsaved boundary edits will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: toView },
    ]);
  }, [isDirty, persistence.saved, draft, editor]);

  const goBack = useCallback(() => {
    if (isDirty) {
      Alert.alert('Leave without saving?', 'Your unsaved boundary edits will be lost.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
      return;
    }
    navigation.goBack();
  }, [isDirty, navigation]);

  const { displayRing, drag, isDrawing, isEditing, isPlacing } = editor;
  const invalid = !draft.validation.isSimple && draft.vertexCount >= MIN_VERTICES;
  const dragBlocked = editor.dragBlocked;

  const draggingVertexId =
    drag && drag.kind === 'vertex' ? drag.vertexId : null;
  const draggingEdgeIndex = drag && drag.kind === 'edge' ? drag.edgeIndex : null;

  const showMidpoints = isEditing && draft.vertexCount >= MIN_VERTICES;

  const status = useMemo<{ text: string; tone: BoundaryStatusTone }>(() => {
    if (dragBlocked) {
      return { text: BOUNDARY_HINTS.editBlocked, tone: 'danger' };
    }
    if (invalid) {
      return {
        text: draft.validation.reason ?? BOUNDARY_HINTS.editIdle,
        tone: 'danger',
      };
    }
    if (isDrawing) {
      if (draft.vertexCount === 0) {
        return { text: BOUNDARY_HINTS.drawEmpty, tone: 'info' };
      }
      if (draft.vertexCount === 1) {
        return { text: BOUNDARY_HINTS.drawOne, tone: 'info' };
      }
      if (draft.vertexCount === 2) {
        return { text: BOUNDARY_HINTS.drawTwo, tone: 'info' };
      }
      return { text: BOUNDARY_HINTS.drawReady, tone: 'info' };
    }
    if (draft.validation.reason) {
      return { text: draft.validation.reason, tone: 'danger' };
    }
    return {
      text: draft.selectedId ? BOUNDARY_HINTS.editSelected : BOUNDARY_HINTS.editIdle,
      tone: 'info',
    };
  }, [dragBlocked, invalid, isDrawing, draft.vertexCount, draft.validation.reason, draft.selectedId]);

  const title = field?.name ?? fieldName ?? 'Field boundary';
  const subtitle = editor.isPlacing
    ? `${draft.vertexCount} point${draft.vertexCount === 1 ? '' : 's'}`
    : persistence.saved
      ? 'Saved boundary'
      : 'No boundary yet';

  return (
    <View style={styles.safe}>
      <View style={styles.mapWrap} onLayout={mapScale.onLayout}>
        <AppMapView
          ref={mapRef}
          onReady={onMapReady}
          mapKind={mapKind}
          initialCenter={fieldCenter}
          initialZoom={18}
          onPress={editor.onMapPress}
          onRegionChange={onRegionChange}
          style={styles.map}>
          <BoundaryPolygon
            ring={displayRing}
            invalid={invalid || dragBlocked}
            strokeWidth={isPlacing ? 3 : 2}
          />

          {isDrawing && displayRing.length >= 2 ? (
            <MapPolyline
              coordinates={[...displayRing]}
              strokeColor={COLORS.white}
              strokeWidth={3}
              lineCap="round"
              lineJoin="round"
              zIndex={2}
            />
          ) : null}

          {isPlacing
            ? draft.vertices.map((vertex, index) => (
                <VertexMarker
                  key={editor.markerKey(vertex.id)}
                  vertex={vertex}
                  index={index}
                  selected={draft.selectedId === vertex.id}
                  isFirst={index === 0}
                  snapTarget={isDrawing && index === 0 && draft.vertexCount >= MIN_VERTICES}
                  invalid={draft.crossingIds.has(vertex.id)}
                  dragging={draggingVertexId === vertex.id}
                  blocked={dragBlocked}
                  draggable
                  onPress={editor.onVertexPress}
                  onDragStart={editor.onVertexDragStart}
                  onDrag={editor.onVertexDrag}
                  onDragEnd={editor.onVertexDragEnd}
                />
              ))
            : null}

          {showMidpoints
            ? draft.midpoints.map(midpoint =>
                draggingEdgeIndex !== null &&
                draggingEdgeIndex !== midpoint.edgeIndex ? null : (
                  <MidpointHandle
                    key={`${midpoint.fromId}>${midpoint.toId}`}
                    midpoint={midpoint}
                    dragging={draggingEdgeIndex === midpoint.edgeIndex}
                    blocked={dragBlocked}
                    onPress={editor.onEdgePress}
                    onDragStart={editor.onEdgeDragStart}
                    onDrag={editor.onEdgeDrag}
                    onDragEnd={editor.onEdgeDragEnd}
                  />
                ),
              )
            : null}
        </AppMapView>

        <View style={[styles.topBar, { top: insets.top + spacing[2] + SEARCH_ROW_H }]}>
          <View style={styles.titlePill}>
            <AppText style={styles.title} numberOfLines={1}>
              {title}
            </AppText>
            <AppText style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </AppText>
          </View>
        </View>

        <MapPlaceSearch
          onPick={goToPlace}
          placeholder="Search your village, town or area…"
          style={[styles.searchWrap, { top: insets.top + spacing[2] }]}
          leftAccessory={
            <Pressable
              onPress={goBack}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Back">
              <AppIcon name="arrow-left" size={moderateScale(22)} color={COLORS.gray900} />
            </Pressable>
          }
        />

        <MapKindSwitch
          value={mapKind}
          onChange={setMapKind}
          style={[
            styles.kindSwitch,
            { top: insets.top + spacing[2] + SEARCH_ROW_H + TITLE_ROW_H },
          ]}
        />

        <MapActionRail
          onFit={editor.fitToBoundary}
          onLocate={goToMyLocation}
          fitDisabled={draft.vertexCount === 0}
          locating={locating}
          style={[
            styles.rail,
            { top: insets.top + spacing[2] + SEARCH_ROW_H + TITLE_ROW_H + scale(52) },
          ]}
        />

        <BoundaryPointsPanel
          ring={draft.ring}
          selected={draft.selectedIndex >= 0 ? draft.selectedIndex : null}
          onSelectPoint={isPlacing ? focusPointAt : undefined}
          style={[
            styles.pointsPanel,
            { top: insets.top + spacing[2] + SEARCH_ROW_H + TITLE_ROW_H },
          ]}
        />

        {isDrawing ? (
          <Pressable
            onPress={addPointAtMyLocation}
            disabled={locating}
            style={[styles.gpsPointBtn, { bottom: insets.bottom + scale(250) }]}
            accessibilityRole="button"
            accessibilityLabel="Add a point where I am standing">
            {locating ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <AppIcon name="crosshairs-gps" size={moderateScale(18)} color={COLORS.white} />
            )}
            <AppText style={styles.gpsPointText}>I'm standing here</AppText>
          </Pressable>
        ) : null}

        {isEditing && draft.selectedVertex ? (
          <NudgePad
            pointNumber={draft.selectedIndex + 1}
            onNudge={editor.nudgeSelected}
            style={[styles.nudgePad, { bottom: insets.bottom + scale(250) }]}
          />
        ) : null}

        {!isReady ? (
          <View style={styles.loading}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : null}
      </View>

      <BoundaryToolbar
        mode={editor.mode}
        hasBoundary={!!persistence.saved}
        hasSelection={draft.selectedId !== null}
        status={status.text}
        statusTone={status.tone}
        areaSqM={editor.liveAreaSqM}
        perimeterM={editor.livePerimeterM}
        vertexCount={draft.vertexCount}
        unit={unit}
        canUndo={draft.canUndo}
        canRedo={draft.canRedo}
        canClose={draft.canClose}
        canDelete={draft.canDelete}
        canAddPoint={draft.vertexCount >= MIN_VERTICES}
        canSave={draft.canSave}
        saving={persistence.saving}
        onCycleUnit={setUnit}
        onStartDraw={startDraw}
        onStartEdit={startEdit}
        onDeleteBoundary={deleteBoundary}
        onUndo={draft.undo}
        onRedo={draft.redo}
        onAddPoint={editor.addPointOnLongestEdge}
        onDeleteVertex={editor.deleteSelected}
        onClose={finishDrawing}
        onCancel={cancelEditing}
        onSave={save}
      />
    </View>
  );
};

export default BoundaryEditorScreen;
