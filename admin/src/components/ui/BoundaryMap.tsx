import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Polyline,
  CircleMarker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import PlaceSearch from "./PlaceSearch";
import {
  type LatLng,
  type GeoJSONPolygon,
  MIN_VERTICES,
  MAX_VERTICES,
  boundaryToRing,
  ringToBoundary,
  ringCenter,
  validateRing,
  isDuplicateOf,
  round6,
} from "../../lib/geo";

const BRAND = "#136F3F";
const DANGER = "#DC2626";

function ClickToAdd({ onAdd }: { onAdd: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onAdd({ lat: round6(e.latlng.lat), lng: round6(e.latlng.lng) });
    },
  });
  return null;
}

/** Frames the drawn shape once, so an existing boundary opens in view. */
function FitOnce({ ring }: { ring: LatLng[] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || ring.length < 2) return;
    done.current = true;
    map.fitBounds(
      ring.map((p) => [p.lat, p.lng] as [number, number]),
      { padding: [30, 30], maxZoom: 18 }
    );
  }, [ring, map]);
  return null;
}

function Recenter({ to }: { to: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (to) map.setView([to.lat, to.lng], Math.max(map.getZoom(), 16));
  }, [to, map]);
  return null;
}

export interface BoundaryMapProps {
  value: GeoJSONPolygon | null;
  onChange: (value: GeoJSONPolygon | null) => void;
  height?: number;
  readOnly?: boolean;
}

/**
 * Draw and edit a field outline. Click to drop corners, drag them to adjust.
 * The same limits and checks the mobile editor uses.
 */
export default function BoundaryMap({
  value,
  onChange,
  height = 340,
  readOnly = false,
}: BoundaryMapProps) {
  const [ring, setRing] = useState<LatLng[]>(() => boundaryToRing(value));
  const [flyTo, setFlyTo] = useState<LatLng | null>(null);
  const lastPushed = useRef<string>("");

  // Adopt a boundary that arrived after mount, without fighting local edits.
  useEffect(() => {
    const incoming = JSON.stringify(value ?? null);
    if (incoming === lastPushed.current) return;
    lastPushed.current = incoming;
    setRing(boundaryToRing(value));
  }, [value]);

  const check = useMemo(() => validateRing(ring), [ring]);

  const crossing = useMemo(() => {
    const ids = new Set<number>();
    const n = ring.length;
    for (const [a, b] of check.crossings) {
      ids.add(a);
      ids.add((a + 1) % n);
      ids.add(b);
      ids.add((b + 1) % n);
    }
    return ids;
  }, [check.crossings, ring.length]);

  function push(next: LatLng[]) {
    setRing(next);
    const polygon = next.length >= MIN_VERTICES ? ringToBoundary(next) : null;
    const valid = validateRing(next);
    lastPushed.current = JSON.stringify(valid.isValid ? polygon : null);
    onChange(valid.isValid ? polygon : null);
  }

  function addPoint(p: LatLng) {
    if (readOnly) return;
    if (ring.length >= MAX_VERTICES) return;
    if (ring.some((existing) => isDuplicateOf(existing, p))) return;
    push([...ring, p]);
  }

  function movePoint(index: number, p: LatLng) {
    const next = ring.map((v, i) => (i === index ? p : v));
    push(next);
  }

  function removePoint(index: number) {
    push(ring.filter((_, i) => i !== index));
  }

  const center = ringCenter(ring) ?? { lat: 22.5937, lng: 78.9629 };
  const positions = ring.map((p) => [p.lat, p.lng] as [number, number]);

  return (
    <div>
      {!readOnly && (
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <PlaceSearch
            className="w-full sm:max-w-sm"
            onPick={(v) => setFlyTo(v)}
            placeholder="Find the field, then click its corners..."
          />
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => push(ring.slice(0, -1))}
              disabled={!ring.length}
              className="btn-secondary py-2 text-sm"
            >
              Undo point
            </button>
            <button
              type="button"
              onClick={() => push([])}
              disabled={!ring.length}
              className="btn-secondary py-2 text-sm"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div
        className="overflow-hidden rounded-lg border border-gray-300"
        style={{ height }}
      >
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={ring.length ? 16 : 5}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {!readOnly && <ClickToAdd onAdd={addPoint} />}
          <FitOnce ring={ring} />
          <Recenter to={flyTo} />

          {ring.length >= 3 && (
            <Polygon
              positions={positions}
              pathOptions={{
                color: check.isValid ? BRAND : DANGER,
                weight: 2,
                fillOpacity: 0.15,
              }}
            />
          )}
          {ring.length === 2 && (
            <Polyline
              positions={positions}
              pathOptions={{ color: BRAND, weight: 2, dashArray: "5 5" }}
            />
          )}

          {ring.map((p, i) => (
            <CircleMarker
              key={`${i}-${p.lat}-${p.lng}`}
              center={[p.lat, p.lng]}
              radius={6}
              pathOptions={{
                color: crossing.has(i) ? DANGER : BRAND,
                fillColor: "#FFFFFF",
                fillOpacity: 1,
                weight: 3,
              }}
              eventHandlers={
                readOnly
                  ? {}
                  : {
                      click(e) {
                        // Removing a corner should not also drop a new one.
                        e.originalEvent.stopPropagation();
                        removePoint(i);
                      },
                      mousedown(e) {
                        e.originalEvent.stopPropagation();
                        const map = e.target._map;
                        map.dragging.disable();
                        const move = (ev: L.LeafletMouseEvent) =>
                          movePoint(i, {
                            lat: round6(ev.latlng.lat),
                            lng: round6(ev.latlng.lng),
                          });
                        const up = () => {
                          map.off("mousemove", move);
                          map.off("mouseup", up);
                          map.dragging.enable();
                        };
                        map.on("mousemove", move);
                        map.on("mouseup", up);
                      },
                    }
              }
            />
          ))}
        </MapContainer>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-4 text-gray-600">
          <span>
            <span className="font-semibold text-gray-900">{ring.length}</span> point
            {ring.length === 1 ? "" : "s"}
          </span>
          <span>
            <span className="font-semibold text-gray-900">
              {check.areaAcres > 0 ? check.areaAcres.toFixed(2) : "-"}
            </span>{" "}
            acres
          </span>
        </div>
        {!readOnly && (
          <p className={check.reason ? "text-danger" : "text-gray-500"}>
            {check.reason ??
              (ring.length
                ? "Looks good. Click a point to remove it, or drag it to move."
                : "Click each corner of the field on the map.")}
          </p>
        )}
      </div>
    </div>
  );
}
