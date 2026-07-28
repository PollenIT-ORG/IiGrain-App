/**
 * BoundaryEditorScreen — the full-screen satellite Farm Boundary editor.
 *
 * This screen is deliberately THIN. It orchestrates; it does not compute. All
 * geometry/edit/undo logic lives in the pure engine (`useBoundaryDraft`), all
 * persistence behind the repository seam (`useBoundaryPersistence`), all
 * rendering in the boundary components. The screen's job is only:
 *   - own the mode (view / draw / edit) and the map-type,
 *   - wire map taps + handle drags to engine actions,
 *   - frame the camera,
 *   - confirm-on-discard and toast-on-save.
 *
 * See docs/maps/FarmBoundary/ (ARCHITECTURE §2, UX §2–7).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../../components/AppIcon';
import AppText from '../../components/AppText/AppText';
import { COLORS, spacing } from '../../constants';
import { moderateScale } from '../../utils';
import { showToast } from '../../services/toastService';
import { useAppSelector } from '../../redux/hooks';
import { selectFields } from '../../redux/slices/fieldSlice';
import { selectSelectedFarm } from '../../redux/slices/farmSlice';
import type { AppScreenProps } from '../../navigation/navigationTypes';
import {
  AppMapView,
  MapCenterPin,
  MapPolygon,
  MapPolyline,
  useMapCamera,
  type LatLng,
  type MapKind,
} from '../../maps';
import {
  BoundaryPolygon,
  BoundaryToolbar,
  MidpointHandle,
  VertexHandle,
  useBoundaryDraft,
  useBoundaryPersistence,
  type BoundaryMode,
} from '../../maps/boundary';
import type { AreaUnit } from '../../maps/utils/geo';
import { styles } from './BoundaryEditorScreenStyle';

const MAP_KINDS: ReadonlyArray<{ value: MapKind; label: string }> = [
  { value: 'satellite', label: 'Satellite' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'standard', label: 'Map' },
];

/** Planar midpoint of two points — fine at field scale for an insert handle. */
const midpoint = (a: LatLng, b: LatLng): LatLng => ({
  latitude: (a.latitude + b.latitude) / 2,
  longitude: (a.longitude + b.longitude) / 2,
});

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
  const draft = useBoundaryDraft();
  const persistence = useBoundaryPersistence({ fieldId, farmId, orgId });

  const [mode, setMode] = useState<BoundaryMode>('view');
  const [mapKind, setMapKind] = useState<MapKind>('satellite');
  const [unit, setUnit] = useState<AreaUnit>('acre');
  const [insertMode, setInsertMode] = useState(false);

  // Load a previously-saved boundary into the draft once, on first ready.
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current || !isReady) {
      return;
    }
    loadedRef.current = true;
    if (persistence.saved) {
      draft.load(persistence.saved.ring);
      camera.fitToCoordinates(persistence.saved.ring);
    } else if (field?.latitude != null && field?.longitude != null) {
      camera.animateToCoordinate(
        { latitude: field.latitude, longitude: field.longitude },
        18,
      );
    }
  }, [isReady, persistence.saved, field, draft, camera]);

  // ── Mode transitions ──────────────────────────────────────────────────
  const startDraw = useCallback(() => {
    draft.reset();
    setInsertMode(false);
    setMode('draw');
  }, [draft]);

  const startEdit = useCallback(() => {
    setInsertMode(false);
    setMode('edit');
  }, []);

  const closeShape = useCallback(() => {
    draft.close();
    setMode('edit');
  }, [draft]);

  // ── Map interactions ──────────────────────────────────────────────────
  const handleMapPress = useCallback(
    (coordinate: LatLng) => {
      if (mode === 'draw') {
        draft.addVertex(coordinate);
      } else if (mode === 'edit' && draft.selected !== null) {
        // Tapping empty map deselects the current vertex.
        draft.select(null);
      }
    },
    [mode, draft],
  );

  // Crosshair precision placement (DRAW): add the current map centre.
  const centerRef = useRef<LatLng | null>(null);
  const handleCenterChange = useCallback((center: LatLng) => {
    centerRef.current = center;
  }, []);
  const addCenterVertex = useCallback(() => {
    if (centerRef.current) {
      draft.addVertex(centerRef.current);
    }
  }, [draft]);

  const toggleInsert = useCallback(() => setInsertMode(v => !v), []);

  const deleteSelected = useCallback(() => {
    if (draft.selected !== null) {
      draft.deleteVertex(draft.selected);
    }
  }, [draft]);

  // ── Save / delete / discard ───────────────────────────────────────────
  const save = useCallback(async () => {
    if (!draft.canSave) {
      return;
    }
    try {
      const stored = await persistence.save(draft.ring);
      draft.load(stored.ring);
      setMode('view');
      setInsertMode(false);
      showToast('Boundary saved.', { type: 'success' });
    } catch {
      showToast('Could not save the boundary. Please try again.', { type: 'error' });
    }
  }, [draft, persistence]);

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
            setMode('view');
            showToast('Boundary deleted.', { type: 'info' });
          },
        },
      ],
    );
  }, [persistence, draft]);

  // Unsaved-edits guard: any draft work while drawing/editing is "dirty".
  const isDirty = mode !== 'view' && (draft.vertexCount > 0 || draft.canUndo);

  const cancelEditing = useCallback(() => {
    const toView = () => {
      // Restore the last saved boundary (or empty) and return to VIEW.
      if (persistence.saved) {
        draft.load(persistence.saved.ring);
      } else {
        draft.reset();
      }
      setInsertMode(false);
      setMode('view');
    };
    if (!isDirty) {
      toView();
      return;
    }
    Alert.alert('Discard changes?', 'Your unsaved boundary edits will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: toView },
    ]);
  }, [isDirty, persistence.saved, draft]);

  const goBack = useCallback(() => {
    if (mode !== 'view' && isDirty) {
      Alert.alert('Leave without saving?', 'Your unsaved boundary edits will be lost.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
      return;
    }
    navigation.goBack();
  }, [mode, isDirty, navigation]);

  const cycleUnit = useCallback((next: AreaUnit) => setUnit(next), []);

  // ── Derived render data ───────────────────────────────────────────────
  const ring = draft.ring;
  const isDrawing = mode === 'draw';
  const isEditing = mode === 'edit';
  const invalid = ring.length >= 3 && !draft.validation.isSimple;

  // ⚠️ TEMP DIAGNOSTIC (Farm Boundary render bug) — remove after root cause.
  // Step 1/2 of the debug plan: confirm the screen holds the vertices and is
  // ready when it renders them.
  if (__DEV__) {
    console.log('[BoundaryEditor] render', {
      mode,
      isReady,
      points: ring.length,
      ring: ring.map(p => [p.latitude, p.longitude]),
    });
  }

  // ⚠️ TEMP DIAGNOSTIC — a hardcoded triangle near the field, drawn with a RAW
  // <MapPolygon>/<MapPolyline> (no BoundaryPolygon wrapper, no engine data).
  // This is steps 7/8 of the debug plan and is the decisive test:
  //   • If the RED triangle + BLUE line appear → react-native-maps Polygon works
  //     on this build; the fault is in our data/wrapper.
  //   • If they do NOT appear (but markers do) → the fault is native/library
  //     (RNMapsGooglePolygon not rendering on this RN 0.84 + maps 1.29 build).
  const testCenter: LatLng =
    field?.latitude != null && field?.longitude != null
      ? { latitude: field.latitude, longitude: field.longitude }
      : { latitude: 20.5937, longitude: 78.9629 };
  const D = 0.0015; // ~150 m
  const TEST_TRIANGLE: LatLng[] = [
    { latitude: testCenter.latitude + D, longitude: testCenter.longitude },
    { latitude: testCenter.latitude - D, longitude: testCenter.longitude - D },
    { latitude: testCenter.latitude - D, longitude: testCenter.longitude + D },
  ];

  // Midpoint insert handles: only in EDIT, only when the Insert tool is on.
  const midpoints = useMemo(() => {
    if (!isEditing || !insertMode || ring.length < 3) {
      return [];
    }
    return ring.map((v, i) => ({
      edgeIndex: i,
      coordinate: midpoint(v, ring[(i + 1) % ring.length]),
    }));
  }, [isEditing, insertMode, ring]);

  return (
    <View style={styles.safe}>
      <View style={styles.mapWrap}>
        <AppMapView
          ref={mapRef}
          onReady={onMapReady}
          mapKind={mapKind}
          initialCenter={
            field?.latitude != null && field?.longitude != null
              ? { latitude: field.latitude, longitude: field.longitude }
              : null
          }
          initialZoom={18}
          onPress={handleMapPress}
          onCenterChange={handleCenterChange}
          style={styles.map}>
          {/* ⚠️ TEMP DIAGNOSTIC — raw hardcoded triangle. Remove after root cause. */}
          {__DEV__ ? (
            <>
              <MapPolygon
                coordinates={TEST_TRIANGLE}
                strokeColor="red"
                strokeWidth={5}
                fillColor="rgba(255,0,0,0.4)"
              />
              <MapPolyline coordinates={TEST_TRIANGLE} strokeColor="blue" strokeWidth={6} />
            </>
          ) : null}

          {/* The filled shape once there are ≥ 3 points. */}
          <BoundaryPolygon ring={ring} invalid={invalid} strokeWidth={isDrawing ? 2 : 3} />

          {/* While drawing, connect every tapped point immediately (≥ 2 points).
              This stays rendered at 3+ too, so the open path the user is tracing
              is always visible alongside the polygon fill. Fresh mutable array:
              the native Polyline takes ownership of `coordinates` and will not
              render when handed the engine's readonly ring (same reason as
              BoundaryPolygon). */}
          {isDrawing && ring.length >= 2 ? (
            <MapPolyline
              coordinates={ring.map(p => ({ latitude: p.latitude, longitude: p.longitude }))}
              strokeColor={COLORS.primary}
              strokeWidth={2}
            />
          ) : null}

          {/* Editable vertex handles (EDIT only). */}
          {isEditing
            ? ring.map((coordinate, index) => (
                <VertexHandle
                  key={`v-${index}`}
                  index={index}
                  coordinate={coordinate}
                  selected={draft.selected === index}
                  onDragEnd={draft.moveVertex}
                  onPress={draft.select}
                />
              ))
            : null}

          {/* Insert-here ghosts (EDIT + Insert tool). */}
          {midpoints.map(m => (
            <MidpointHandle
              key={`m-${m.edgeIndex}`}
              edgeIndex={m.edgeIndex}
              coordinate={m.coordinate}
              onPress={draft.insertVertex}
            />
          ))}
        </AppMapView>

        {/* Fixed crosshair for precision placement while drawing. */}
        {isDrawing ? <MapCenterPin lifted={false} /> : null}

        {/* Top bar: back · title · map-type switch. */}
        <View style={[styles.topBar, { top: insets.top + spacing[2] }]}>
          <Pressable
            onPress={goBack}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back">
            <AppIcon name="arrow-left" size={moderateScale(22)} color={COLORS.gray900} />
          </Pressable>
          <View style={styles.titlePill}>
            <AppText style={styles.title} numberOfLines={1}>
              {field?.name ?? fieldName ?? 'Field boundary'}
            </AppText>
            <AppText style={styles.subtitle}>
              {mode === 'view'
                ? persistence.saved
                  ? 'Saved boundary'
                  : 'No boundary yet'
                : mode === 'draw'
                ? 'Tap the field corners'
                : 'Drag points to adjust'}
            </AppText>
          </View>
        </View>

        {/* Map-type switch, below the top bar. */}
        <View style={[styles.kindSwitch, { top: insets.top + spacing[2] + 52 }]}>
          {MAP_KINDS.map(kind => {
            const active = kind.value === mapKind;
            return (
              <Pressable
                key={kind.value}
                onPress={() => setMapKind(kind.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.kindOption, active && styles.kindOptionActive]}>
                <AppText style={[styles.kindLabel, active && styles.kindLabelActive]}>
                  {kind.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {/* Crosshair precision "add point" button (DRAW). */}
        {isDrawing ? (
          <Pressable
            onPress={addCenterVertex}
            style={[styles.addPointBtn, { bottom: insets.bottom + 180 }]}
            accessibilityRole="button"
            accessibilityLabel="Add point at crosshair">
            <AppIcon name="map-marker-plus-outline" size={moderateScale(20)} color={COLORS.white} />
            <AppText style={styles.addPointText}>Add point</AppText>
          </Pressable>
        ) : null}

        {!isReady ? (
          <View style={styles.loading}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : null}
      </View>

      <BoundaryToolbar
        mode={mode}
        hasBoundary={!!persistence.saved}
        selectedVertex={draft.selected}
        insertMode={insertMode}
        areaSqM={draft.areaSqM}
        vertexCount={draft.vertexCount}
        unit={unit}
        canUndo={draft.canUndo}
        canRedo={draft.canRedo}
        canClose={draft.canClose}
        canSave={draft.canSave}
        saving={persistence.saving}
        invalidReason={draft.canSave ? null : draft.validation.reason}
        onCycleUnit={cycleUnit}
        onStartDraw={startDraw}
        onStartEdit={startEdit}
        onDeleteBoundary={deleteBoundary}
        onUndo={draft.undo}
        onRedo={draft.redo}
        onToggleInsert={toggleInsert}
        onDeleteVertex={deleteSelected}
        onDeselect={() => draft.select(null)}
        onClose={closeShape}
        onCancel={cancelEditing}
        onSave={save}
      />
    </View>
  );
};

export default BoundaryEditorScreen;
