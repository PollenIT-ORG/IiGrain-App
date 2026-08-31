import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import PlaceSearch from "./PlaceSearch";

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface LatLng {
  lat: number;
  lng: number;
}

interface MapPickerProps {
  value: LatLng | null;
  onChange: (v: LatLng) => void;
  defaultCenter?: LatLng;
  height?: number;
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function ClickCapture({ onPick }: { onPick: (v: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: round6(e.latlng.lat), lng: round6(e.latlng.lng) });
    },
  });
  return null;
}

function Recenter({ value }: { value: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (value) map.setView([value.lat, value.lng], Math.max(map.getZoom(), 14));
  }, [value, map]);
  return null;
}

export default function MapPicker({
  value,
  onChange,
  defaultCenter = { lat: 22.5937, lng: 78.9629 },
  height = 300,
}: MapPickerProps) {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const markerRef = useRef<L.Marker>(null);

  const center = value ?? defaultCenter;
  const initialZoom = value ? 14 : 5;

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setGeoError("Location is not available in this browser.");
      return;
    }
    setLocating(true);
    setGeoError(null);

    const onSuccess = (pos: GeolocationPosition) => {
      onChange({
        lat: round6(pos.coords.latitude),
        lng: round6(pos.coords.longitude),
      });
      setLocating(false);
    };

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      () => {
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          (err) => {
            setGeoError(
              err.code === err.PERMISSION_DENIED
                ? "Location permission was denied. Allow location access and try again."
                : "Couldn't get your location. Search a place or click the map instead."
            );
            setLocating(false);
          },
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        );
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  }

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const m = markerRef.current;
        if (m) {
          const p = m.getLatLng();
          onChange({ lat: round6(p.lat), lng: round6(p.lng) });
        }
      },
    }),
    [onChange]
  );

  return (
    <div>
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <PlaceSearch
          className="w-full sm:max-w-sm"
          onPick={(v) => onChange({ lat: round6(v.lat), lng: round6(v.lng) })}
        />

        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="btn-secondary shrink-0 text-sm"
        >
          {locating ? "Locating..." : "Use my current location"}
        </button>
      </div>

      <div
        className="overflow-hidden rounded-lg border border-gray-300"
        style={{ height }}
      >
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={initialZoom}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickCapture onPick={onChange} />
          <Recenter value={value} />
          {value && (
            <Marker
              draggable
              position={[value.lat, value.lng]}
              icon={markerIcon}
              eventHandlers={eventHandlers}
              ref={markerRef}
            />
          )}
        </MapContainer>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500">
          {value
            ? "Search, drag the pin, or click the map to adjust the exact location."
            : "Search a place, click the map, or use your current location to drop a pin."}
        </p>
        {value && (
          <span className="shrink-0 font-mono text-xs text-gray-500">
            {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
          </span>
        )}
      </div>
      {geoError && <p className="field-error">{geoError}</p>}
    </div>
  );
}
