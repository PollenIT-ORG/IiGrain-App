import http from '../services/http';
import { Endpoints } from '../config/endpoints';
import type { Farm } from '../types/farm';

interface Envelope<T> {
  data: T;
}

interface RawFarm {
  id: string;
  name: string;
  area_acres: string;
  location: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  owner_id: string;
  owner_name: string;
  owner_email: string;
  org_id: string | null;
  org_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface MyFarmsPayload {
  farms: RawFarm[];
}

interface FarmDetailPayload {
  farm: RawFarm;
}

export interface CreateFarmInput {
  name: string;
  areaAcres?: number;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface UpdateFarmInput {
  name?: string;
  areaAcres?: number;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
}

const toNumberOrNull = (raw: number | string | null | undefined): number | null => {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  const n = typeof raw === 'number' ? raw : parseFloat(raw);
  return Number.isFinite(n) ? n : null;
};

const mapFarm = (raw: RawFarm): Farm => ({
  id: raw.id,
  name: raw.name,
  ownerName: raw.owner_name,
  location: raw.location,
  areaAcres: parseFloat(raw.area_acres) || 0,
  fieldsCount: 0,
  status: raw.is_active ? 'active' : 'inactive',
  lastUpdatedISO: raw.updated_at,
  soilType: '',
  regenScore: 0,
  latitude: toNumberOrNull(raw.latitude),
  longitude: toNumberOrNull(raw.longitude),
  ownerEmail: raw.owner_email,
  orgId: raw.org_id ?? undefined,
  orgName: raw.org_name ?? undefined,
  createdAt: raw.created_at,
});

export const getMyFarms = async (): Promise<Farm[]> => {
  const res = await http.get<Envelope<MyFarmsPayload>>(Endpoints.farms.myFarms);
  return (res.data.data.farms ?? []).map(mapFarm);
};

export const getFarmDetails = async (farmId: string): Promise<Farm> => {
  const res = await http.get<Envelope<FarmDetailPayload>>(
    Endpoints.farms.myFarm(farmId),
  );
  return mapFarm(res.data.data.farm);
};

export const createMyFarm = async (input: CreateFarmInput): Promise<Farm> => {
  const body: Record<string, string | number | null> = { name: input.name };
  if (input.areaAcres !== undefined) {
    body.areaAcres = input.areaAcres;
  }
  if (input.location !== undefined && input.location !== '') {
    body.location = input.location;
  }
  if (input.latitude !== undefined) {
    body.latitude = input.latitude;
  }
  if (input.longitude !== undefined) {
    body.longitude = input.longitude;
  }
  const res = await http.post<Envelope<FarmDetailPayload>>(
    Endpoints.farms.myFarms,
    body,
  );
  return mapFarm(res.data.data.farm);
};

export const updateMyFarm = async (
  farmId: string,
  input: UpdateFarmInput,
): Promise<Farm> => {
  const body: Record<string, string | number | null> = {};
  if (input.name !== undefined) {
    body.name = input.name;
  }
  if (input.areaAcres !== undefined) {
    body.areaAcres = input.areaAcres;
  }
  if (input.location !== undefined) {
    body.location = input.location;
  }
  if (input.latitude !== undefined) {
    body.latitude = input.latitude;
  }
  if (input.longitude !== undefined) {
    body.longitude = input.longitude;
  }
  const res = await http.patch<Envelope<FarmDetailPayload>>(
    Endpoints.farms.myFarm(farmId),
    body,
  );
  return mapFarm(res.data.data.farm);
};
