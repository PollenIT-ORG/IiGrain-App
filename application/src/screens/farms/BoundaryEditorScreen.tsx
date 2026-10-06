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
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { selectFields } from '../../redux/slices/fieldSlice';
import { getFarmField } from '../../api/FieldApi';
import type { Field } from '../../types/farm';
import { selectSelectedFarm } from '../../redux/slices/farmSlice';
import {
  markDrawTutorialSeen,
  selectDrawTutorialSeen,
} from '../../redux/slices/boundarySlice';
import type { AppScreenProps } from '../../navigation/navigationTypes';
import {
  AppMapView,
  MapKindSwitch,
  MapPlaceSearch,
  MapPolyline,
  MAP_ZOOM,
  DEFAULT_MAP_REGION,
  regionFromZoom,
  useMapCamera,
  type LatLng,
  type MapKind,
  type MapRegion,
} from '../../maps';
import {
  BoundaryDrawTutorial,
  BoundaryHandleLayer,
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
  USE_OVERLAY_HANDLES,
  type BoundaryHandleLayerHandle,
  type BoundaryStatusTone,
  type BoundaryVertex,
} from '../../maps/boundary';
import { convertArea, type AreaUnit } from '../../maps/utils/geo';
import { formatAcres, roundAcres } from '../../maps/utils/fieldAcres';
import { resolveFieldCenter } from '../../maps/utils/fieldCenter';
import type { Place } from '../../services/geocoding';
import { logMapKeysDevOnly } from '../../maps/devMapKeysLog';
import { styles } from './BoundaryEditorScreenStyle';

const SEARCH_ROW_H = scale(54);
const TITLE_ROW_H = scale(52);

const NO_VERTICES: readonly BoundaryVertex[] = [];

const sameRing = (a: readonly LatLng[] | null, b: readonly LatLng[] | null): boolean => {
  if (a === b) {
    return true;
  }
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  return a.every(
    (point, i) => point.latitude === b[i].latitude && point.longitude === b[i].longitude,
  );
};

const BoundaryEditorScreen: React.FC<AppScreenProps<'BoundaryEditor'>> = ({
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { farmId, fieldId, fieldName, latitude, longitude, initialRing, maxAcres, onSave } =
    route.params;
  const isDraft = !fieldId;

  useEffect(() => {
    logMapKeysDevOnly('BoundaryEditor');
  }, []);

  const dispatch = useAppDispatch();
  const fields = useAppSelector(selectFields);
  const selectedFarm = useAppSelector(selectSelectedFarm);
  const drawTutorialSeen = useAppSelector(selectDrawTutorialSeen);
  const [remoteField, setRemoteField] = useState<Field | null>(null);
  const field = useMemo(
    () => fields.find(f => f.id === fieldId) ?? remoteField,
    [fields, fieldId, remoteField],
  );

  const routeCenter = useMemo<LatLng | null>(
    () => resolveFieldCenter({ latitude, longitude }),
    [latitude, longitude],
  );

  const askedRef = useRef(false);
  const [locatingField, setLocatingField] = useState(!!fieldId && !routeCenter && !field);
  useEffect(() => {
    if (routeCenter || field || askedRef.current || !farmId || !fieldId) {
      setLocatingField(false);
      return;
    }
    askedRef.current = true;
    let alive = true;
    getFarmField(farmId, fieldId)
      .then(found => {
        if (alive && found) {
          setRemoteField(found);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) {
          setLocatingField(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [routeCenter, field, farmId, fieldId]);
  const orgId = selectedFarm?.id === farmId ? selectedFarm.orgId ?? null : null;

  const { mapRef, onMapReady, isReady, camera } = useMapCamera();
  const editor = useBoundaryEditor({ camera });
  const { draft, scale: mapScale } = editor;
  const persistence = useBoundaryPersistence({ fieldId: fieldId ?? '', farmId, orgId });
  const committedRing = isDraft ? (initialRing ?? null) : (persistence.saved?.ring ?? null);

  const [mapKind, setMapKind] = useState<MapKind>('satellite');
  const [unit, setUnit] = useState<AreaUnit>('acre');
  const [locating, setLocating] = useState(false);

  // Handle overlay (iOS): it owns the live region so a pan re-renders only the
  // handles, and it freezes map gestures while a handle is under the finger.
  const handleLayerRef = useRef<BoundaryHandleLayerHandle | null>(null);
  const [handleDragging, setHandleDragging] = useState(false);

  const fieldCenter = useMemo<LatLng | null>(
    () =>
      resolveFieldCenter(
        routeCenter,
        field,
        selectedFarm?.id === farmId ? selectedFarm : null,
      ),
    [routeCenter, field, selectedFarm, farmId],
  );

  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current || !isReady || persistence.hydrating) {
      return;
    }
    if (committedRing) {
      loadedRef.current = true;
      draft.load(committedRing);
      camera.fitToCoordinates(committedRing);
      return;
    }
    if (fieldCenter) {
      loadedRef.current = true;
      camera.setCoordinate(fieldCenter, 18);
    }
  }, [isReady, persistence.hydrating, committedRing, fieldCenter, draft, camera]);

  const { rejection, clearRejection } = draft;
  const rejectionSeqRef = useRef(0);
  useEffect(() => {
    if (!rejection || rejection.seq === rejectionSeqRef.current) {
      return;
    }
    rejectionSeqRef.current = rejection.seq;
    showToast(rejection.message, { type: 'info' });
    clearRejection();
  }, [rejection, clearRejection]);

  const onRegionChange = useCallback(
    (region: MapRegion) => {
      mapScale.onRegionChange(region);
      handleLayerRef.current?.setRegion(region);
    },
    [mapScale],
  );

  // onRegionChange is not guaranteed to fire before the first gesture; the
  // settle callback always does, so the overlay is never left on a stale frame.
  const onCenterChange = useCallback((_center: LatLng, region: MapRegion) => {
    handleLayerRef.current?.setRegion(region);
  }, []);

  // First time a device draws, the map alone gives no clue what to do —
  // there's nothing on a farm field to indicate "tap here". The coach mark
  // demos the exact gesture once; after that the same status-bar hints do
  // the job, same as they always have.
  const [tutorialVisible, setTutorialVisible] = useState(false);

  const startDraw = useCallback(() => {
    draft.reset();
    editor.setMode('draw');
    if (drawTutorialSeen) {
      showToast(BOUNDARY_HINTS.drawEmpty, { type: 'info' });
    } else {
      setTutorialVisible(true);
    }
  }, [draft, editor, drawTutorialSeen]);

  const dismissTutorial = useCallback(() => {
    setTutorialVisible(false);
    dispatch(markDrawTutorialSeen());
    showToast(BOUNDARY_HINTS.drawEmpty, { type: 'info' });
  }, [dispatch]);

  // Lets anyone revisit the how-to-draw coach mark on demand — the automatic
  // showing is once-per-device, so this is the only way back to it afterwards.
  const replayTutorial = useCallback(() => {
    draft.reset();
    editor.setMode('draw');
    setTutorialVisible(true);
  }, [draft, editor]);

  // Defensive: if a real point ever lands while the coach mark is up (it
  // shouldn't — the scrim blocks the map), get out of the way immediately
  // rather than layering a demo over a boundary the farmer is actually
  // drawing.
  useEffect(() => {
    if (tutorialVisible && draft.vertexCount > 0) {
      setTutorialVisible(false);
      dispatch(markDrawTutorialSeen());
    }
  }, [tutorialVisible, draft.vertexCount, dispatch]);

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
    if (isDraft) {
      onSave?.(draft.ring);
      editor.setMode('view');
      navigation.goBack();
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
  }, [draft, isDraft, onSave, persistence, editor, navigation]);

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
            if (isDraft) {
              onSave?.(null);
            } else {
              persistence.remove().catch(() => {});
            }
            draft.reset();
            editor.setMode('view');
            showToast('Boundary deleted.', { type: 'info' });
          },
        },
      ],
    );
  }, [isDraft, onSave, persistence, draft, editor]);

  const isDirty = editor.isPlacing && (draft.vertexCount > 0 || draft.canUndo);

  const cancelEditing = useCallback(() => {
    const toView = () => {
      if (committedRing) {
        draft.load(committedRing);
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
  }, [isDirty, committedRing, draft, editor]);

  const goBack = useCallback(() => {
    if (isDirty) {
      Alert.alert('Leave without saving?', 'Your unsaved boundary edits will be lost.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
      return;
    }
    if (isDraft) {
      const ring = draft.vertexCount >= MIN_VERTICES ? draft.ring : null;
      if (!sameRing(ring, committedRing)) {
        onSave?.(ring);
      }
    }
    navigation.goBack();
  }, [isDirty, isDraft, draft, committedRing, onSave, navigation]);

  const { displayRing, drag, isDrawing, isEditing, isPlacing } = editor;
  const invalid = !draft.validation.isSimple && draft.vertexCount >= MIN_VERTICES;
  const dragBlocked = editor.dragBlocked;

  const draggingEdgeIndex = drag && drag.kind === 'edge' ? drag.edgeIndex : null;

  const showMidpoints = isEditing && draft.vertexCount >= MIN_VERTICES;

  // The overlay draws from plain state, so the vertex under the finger has to
  // carry the live drag position itself (the native markers move themselves).
  const handleVertices = useMemo(
    () =>
      drag && drag.kind === 'vertex'
        ? draft.vertices.map((vertex, index) =>
            index === drag.index
              ? {
                  ...vertex,
                  latitude: drag.point.latitude,
                  longitude: drag.point.longitude,
                }
              : vertex,
          )
        : draft.vertices,
    [draft.vertices, drag],
  );

  // Only ever the overlay's *seed*: once mounted it tracks the map itself.
  const initialRegion = useMemo<MapRegion>(
    () => (fieldCenter ? regionFromZoom(fieldCenter, 18) : DEFAULT_MAP_REGION),
    [fieldCenter],
  );

  const limitAcres = useMemo(() => {
    if (typeof maxAcres === 'number') {
      return roundAcres(maxAcres);
    }
    const farm = selectedFarm?.id === farmId ? selectedFarm : null;
    if (!farm || farm.availableAcres == null) {
      return null;
    }
    const ownAcres = fieldId ? field?.areaAcres ?? 0 : 0;
    return roundAcres(farm.availableAcres + ownAcres);
  }, [maxAcres, selectedFarm, farmId, fieldId, field]);

  const liveAcres = roundAcres(convertArea(editor.liveAreaSqM, 'acre'));
  const overLimit = limitAcres !== null && liveAcres > limitAcres;

  const status = useMemo<{ text: string; tone: BoundaryStatusTone }>(() => {
    if (overLimit && limitAcres !== null) {
      return {
        text: `${formatAcres(liveAcres)} ac is bigger than this farm — only ${formatAcres(
          limitAcres,
        )} ac are free. Make the shape smaller.`,
        tone: 'danger',
      };
    }
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
  }, [
    overLimit,
    limitAcres,
    liveAcres,
    dragBlocked,
    invalid,
    isDrawing,
    draft.vertexCount,
    draft.validation.reason,
    draft.selectedId,
  ]);

  const title = field?.name ?? fieldName ?? 'Field boundary';
  const subtitle = editor.isPlacing
    ? `${draft.vertexCount} point${draft.vertexCount === 1 ? '' : 's'}`
    : committedRing
      ? isDraft
        ? 'Boundary traced'
        : 'Saved boundary'
      : 'No boundary yet';

  return (
    <View style={styles.safe}>
      <View style={styles.mapWrap} onLayout={mapScale.onLayout}>
        {locatingField ? (
          <View style={styles.mapLoading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <AppText style={styles.mapLoadingText}>Finding this field…</AppText>
          </View>
        ) : null}
        <AppMapView
          ref={mapRef}
          onReady={onMapReady}
          mapKind={mapKind}
          initialCenter={fieldCenter}
          initialZoom={18}
          onPress={editor.onMapPress}
          onRegionChange={onRegionChange}
          onCenterChange={onCenterChange}
          interactive={!handleDragging}
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

          {isPlacing && !USE_OVERLAY_HANDLES
            ? draft.vertices.map((vertex, index) => (
                <VertexMarker
                  key={editor.markerKey(vertex.id)}
                  vertex={vertex}
                  index={index}
                  selected={draft.selectedId === vertex.id}
                  isFirst={index === 0}
                  snapTarget={isDrawing && index === 0 && draft.vertexCount >= MIN_VERTICES}
                  invalid={draft.crossingIds.has(vertex.id)}
                  draggable
                  onPress={editor.onVertexPress}
                  onDragStart={editor.onVertexDragStart}
                  onDrag={editor.onVertexDrag}
                  onDragEnd={editor.onVertexDragEnd}
                />
              ))
            : null}

          {showMidpoints && !USE_OVERLAY_HANDLES
            ? draft.midpoints.map(midpoint =>
                draggingEdgeIndex !== null &&
                draggingEdgeIndex !== midpoint.edgeIndex ? null : (
                  <MidpointHandle
                    key={`${midpoint.fromId}>${midpoint.toId}`}
                    midpoint={midpoint}
                    onPress={editor.onEdgePress}
                    onDragStart={editor.onEdgeDragStart}
                    onDrag={editor.onEdgeDrag}
                    onDragEnd={editor.onEdgeDragEnd}
                  />
                ),
              )
            : null}
        </AppMapView>

        {/* Mounted in every mode — an overlay that unmounts stops receiving
            region updates and comes back pinned to a stale frame. It simply
            draws nothing outside draw/edit. */}
        {USE_OVERLAY_HANDLES ? (
          <BoundaryHandleLayer
            ref={handleLayerRef}
            vertices={isPlacing ? handleVertices : NO_VERTICES}
            midpoints={draft.midpoints}
            initialRegion={initialRegion}
            selectedId={draft.selectedId}
            crossingIds={draft.crossingIds}
            snapToFirst={isDrawing && draft.vertexCount >= MIN_VERTICES}
            showMidpoints={showMidpoints}
            activeEdgeIndex={draggingEdgeIndex}
            activeEdgePoint={drag && drag.kind === 'edge' ? drag.point : null}
            onVertexPress={editor.onVertexPress}
            onVertexDragStart={editor.onVertexDragStart}
            onVertexDrag={editor.onVertexDrag}
            onVertexDragEnd={editor.onVertexDragEnd}
            onEdgePress={editor.onEdgePress}
            onEdgeDragStart={editor.onEdgeDragStart}
            onEdgeDrag={editor.onEdgeDrag}
            onEdgeDragEnd={editor.onEdgeDragEnd}
            onDragActiveChange={setHandleDragging}
          />
        ) : null}

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

        {editor.mode === 'view' && !committedRing ? (
          <Pressable
            onPress={replayTutorial}
            style={[styles.howToDrawBtn, { bottom: insets.bottom + scale(130) }]}
            accessibilityRole="button"
            accessibilityLabel="How to draw a boundary">
            <AppIcon name="help-circle-outline" size={moderateScale(16)} color={COLORS.white} />
            <AppText style={styles.howToDrawText}>How to draw</AppText>
          </Pressable>
        ) : null}

        {!isReady ? (
          <View style={styles.loading} pointerEvents="none">
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : null}
      </View>

      <BoundaryToolbar
        mode={editor.mode}
        hasBoundary={!!committedRing}
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
        canSave={draft.canSave && !overLimit}
        saving={persistence.saving}
        saveLabel={isDraft ? 'Use this boundary' : undefined}
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

      <BoundaryDrawTutorial visible={tutorialVisible} onDismiss={dismissTutorial} />
    </View>
  );
};

export default BoundaryEditorScreen;
