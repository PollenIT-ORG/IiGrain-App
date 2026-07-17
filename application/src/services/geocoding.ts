import axios from 'axios';

export interface Place {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
}

const geo = axios.create({
  baseURL: 'https://nominatim.openstreetmap.org',
  timeout: 12000,
  headers: {
    'User-Agent': 'iiGrain-Mobile/1.0 (support@iigrain.app)',
    'Accept-Language': 'en',
  },
});

export const searchPlaces = async (
  query: string,
  signal?: AbortSignal,
): Promise<Place[]> => {
  const q = query.trim();
  if (q.length < 3) {
    return [];
  }
  const res = await geo.get('/search', {
    signal,
    params: { q, format: 'jsonv2', limit: 8, addressdetails: 0 },
  });
  const rows: Record<string, unknown>[] = Array.isArray(res.data) ? res.data : [];
  return rows
    .map((r, i) => ({
      id: String(r.place_id ?? i),
      label: String(r.display_name ?? ''),
      latitude: Number(r.lat),
      longitude: Number(r.lon),
    }))
    .filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
};

export interface AddressResult {
  title: string;
  subtitle: string;
  full: string;
}

type NominatimAddress = Record<string, string | undefined>;
interface NominatimReverse {
  name?: string;
  display_name?: string;
  address?: NominatimAddress;
}

const firstOf = (...vals: (string | undefined)[]): string =>
  vals.find(v => !!v && v.trim().length > 0)?.trim() ?? '';

export const reverseGeocode = async (
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<AddressResult> => {
  const res = await geo.get('/reverse', {
    signal,
    params: { lat: latitude, lon: longitude, format: 'jsonv2', zoom: 18, addressdetails: 1 },
  });
  const data = (res.data ?? {}) as NominatimReverse;
  const a = data.address ?? {};
  const full = data.display_name ?? '';

  const parts = full
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const namedPoi = firstOf(
    data.name,
    a.amenity, a.building, a.shop, a.office, a.tourism, a.leisure, a.historic, a.man_made,
  );
  const title = namedPoi || parts[0] || 'Selected location';

  const seen = new Set<string>([title.toLowerCase()]);
  const subtitle = parts
    .filter(p => {
      const key = p.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .join(', ');

  console.log('[geocoding] reverse →', { title, subtitle, full });
  return { title, subtitle, full };
};
