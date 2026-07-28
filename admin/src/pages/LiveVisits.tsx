import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useListActiveVisitsQuery, type Visit } from "../store/endpoints/visitsApi";
import { getSocket } from "../lib/socket";
import { useLiveData } from "../lib/useLiveData";
import Loader from "../components/Loader";

type LatLng = [number, number];

const OSRM_URL =
  import.meta.env.VITE_OSRM_URL?.replace(/\/+$/, "") ||
  "https://router.project-osrm.org";

function useRoadRoute(from: LatLng | null, to: LatLng | null): LatLng[] | null {
  const [route, setRoute] = useState<LatLng[] | null>(null);

  const key =
    from && to
      ? `${from[0].toFixed(4)},${from[1].toFixed(4)};${to[0].toFixed(4)},${to[1].toFixed(4)}`
      : null;

  useEffect(() => {
    if (!from || !to) {
      setRoute(null);
      return;
    }
    const controller = new AbortController();
    const url =
      `${OSRM_URL}/route/v1/driving/` +
      `${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    fetch(url, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        const coords = d?.routes?.[0]?.geometry?.coordinates as
          | [number, number][]
          | undefined;
        if (coords?.length) {
          setRoute(coords.map(([lng, lat]) => [lat, lng] as LatLng));
        } else {
          setRoute(null);
        }
      })
      .catch(() => setRoute(null));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return route;
}

function emojiPin(emoji: string, label: string, ring: string) {
  return L.divIcon({
    className: "",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-6px)">
        <div style="width:34px;height:34px;border-radius:50%;background:#fff;
          border:3px solid ${ring};box-shadow:0 2px 6px rgba(0,0,0,.35);
          display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1">${emoji}</div>
        <span style="margin-top:3px;padding:1px 6px;border-radius:6px;background:${ring};
          color:#fff;font:600 10px/1.4 system-ui,Arial;white-space:nowrap;
          box-shadow:0 1px 3px rgba(0,0,0,.3)">${label}</span>
      </div>`,
    iconSize: [34, 48],
    iconAnchor: [17, 24],
    popupAnchor: [0, -26],
  });
}

const ASSESSOR_COLOR = "#136F3F";
const DEST_COLOR = "#374151";

function statusChip(status: Visit["status"]) {
  const map: Record<Visit["status"], string> = {
    en_route: "bg-info/10 text-info",
    arrived: "bg-success/10 text-success",
    completed: "bg-gray-200 text-gray-600",
    cancelled: "bg-danger/10 text-danger",
  };
  const label: Record<Visit["status"], string> = {
    en_route: "En route",
    arrived: "Arrived",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[status]}`}
    >
      {label[status]}
    </span>
  );
}

function FitBounds({ visit }: { visit: Visit | null }) {
  const map = useMap();
  useEffect(() => {
    if (!visit) return;
    const pts: [number, number][] = [];
    if (visit.last_latitude != null && visit.last_longitude != null)
      pts.push([visit.last_latitude, visit.last_longitude]);
    if (visit.dest_latitude != null && visit.dest_longitude != null)
      pts.push([visit.dest_latitude, visit.dest_longitude]);
    if (pts.length === 1) map.setView(pts[0], Math.max(map.getZoom(), 14));
    else if (pts.length === 2) map.fitBounds(pts, { padding: [50, 50] });
  }, [visit, map]);
  return null;
}

export default function LiveVisits() {
  const { data: initial, isLoading, refetch } = useListActiveVisitsQuery();
  // Refetch the active-visits list when a visit starts or ends (the backend
  // broadcasts a "visits" change to all admins).
  useLiveData(["visits"], refetch);
  const [visits, setVisits] = useState<Record<string, Visit>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const joined = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (initial) {
      const next: Record<string, Visit> = {};
      for (const v of initial) next[v.id] = v;
      setVisits(next);
      if (!selectedId && initial.length) setSelectedId(initial[0].id);
    }
  }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const socket = getSocket();

    const apply = (v: Visit) => {
      setVisits((prev) => {
        if (v.status === "completed" || v.status === "cancelled") {
          const copy = { ...prev };
          delete copy[v.id];
          return copy;
        }
        return { ...prev, [v.id]: v };
      });
    };

    socket.on("visit:location", apply);
    socket.on("visit:status", apply);
    socket.on("visit:incoming", () => refetch());

    return () => {
      socket.off("visit:location", apply);
      socket.off("visit:status", apply);
      socket.off("visit:incoming");
    };
  }, [refetch]);

  useEffect(() => {
    const socket = getSocket();
    for (const id of Object.keys(visits)) {
      if (!joined.current.has(id)) {
        socket.emit("visit:join", { visitId: id });
        joined.current.add(id);
      }
    }
  }, [visits]);

  const list = useMemo(
    () =>
      Object.values(visits).sort(
        (a, b) => +new Date(b.started_at) - +new Date(a.started_at)
      ),
    [visits]
  );
  const selected = selectedId ? visits[selectedId] ?? null : null;

  const assessorPos: LatLng | null =
    selected?.last_latitude != null && selected?.last_longitude != null
      ? [selected.last_latitude, selected.last_longitude]
      : null;
  const destPos: LatLng | null =
    selected?.dest_latitude != null && selected?.dest_longitude != null
      ? [selected.dest_latitude, selected.dest_longitude]
      : null;

  const road = useRoadRoute(assessorPos, destPos);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Live visits</h1>
        <p className="mt-1 text-sm text-gray-500">
          Assessors currently visiting farmers, tracked in real time.
        </p>
      </div>

      {isLoading ? (
        <Loader message="Loading visits..." />
      ) : list.length === 0 ? (
        <div className="card px-5 py-16 text-center text-sm text-gray-500">
          No active visits right now.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-1">
            {list.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedId(v.id)}
                className={`card w-full p-4 text-left transition ${
                  selectedId === v.id
                    ? "ring-2 ring-primary"
                    : "hover:shadow-card-hover"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-semibold text-gray-900">
                    <span aria-hidden>🚶</span>
                    {v.assessor_name ?? "Assessor"}
                  </span>
                  {statusChip(v.status)}
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                  <span aria-hidden>📍</span>
                  {v.field_name ?? "Field"}
                  {v.farmer_name ? ` · ${v.farmer_name}` : ""}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {v.last_location_at
                    ? `Updated ${new Date(
                        v.last_location_at
                      ).toLocaleTimeString()}`
                    : "Awaiting first location..."}
                </p>
              </button>
            ))}
          </div>

          <div className="card overflow-hidden lg:col-span-2">
            <div className="flex flex-wrap items-center gap-4 border-b border-gray-200 px-4 py-2.5 text-xs text-gray-600">
              <span className="flex items-center gap-1.5">
                <span aria-hidden>🚶</span>
                <span className="font-medium">Assessor</span> (live position)
              </span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden>📍</span>
                <span className="font-medium">Destination field</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-0.5 w-6 rounded"
                  style={{ background: "#136F3F" }}
                />
                Road route
              </span>
            </div>
            <div className="h-[520px]">
              <MapContainer
                center={[22.5937, 78.9629]}
                zoom={5}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitBounds visit={selected} />

                {destPos && (
                  <Marker
                    position={destPos}
                    icon={emojiPin(
                      "📍",
                      selected?.field_name ?? "Field",
                      DEST_COLOR
                    )}
                  >
                    <Popup>
                      <strong>Destination field</strong>
                      <br />
                      {selected?.field_name ?? "Field"}
                      {selected?.farmer_name ? ` · ${selected.farmer_name}` : ""}
                    </Popup>
                  </Marker>
                )}

                {assessorPos && (
                  <Marker
                    position={assessorPos}
                    icon={emojiPin("🚶", "Assessor", ASSESSOR_COLOR)}
                  >
                    <Popup>
                      <strong>Assessor (live)</strong>
                      <br />
                      {selected?.assessor_name ?? "Assessor"}
                    </Popup>
                  </Marker>
                )}

                {assessorPos && destPos && (
                  <Polyline
                    positions={road ?? [assessorPos, destPos]}
                    pathOptions={{
                      color: ASSESSOR_COLOR,
                      weight: 4,
                      opacity: 0.8,
                      dashArray: road ? undefined : "6 8",
                    }}
                  />
                )}
              </MapContainer>
            </div>
            {selected && !assessorPos && (
              <p className="border-t border-gray-200 px-5 py-3 text-sm text-gray-500">
                Waiting for {selected.assessor_name ?? "the assessor"}'s first
                location update...
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
