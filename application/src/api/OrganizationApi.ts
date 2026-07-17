import http from '../services/http';
import { Endpoints } from '../config/endpoints';
import type { Organization, OrgStatus } from '../types/organization';

interface Envelope<T> {
  data: T;
}

interface RawOrganization {
  id: string;
  name: string;
  description?: string | null;
  role?: string | null;
  status?: string;
  assigned_at?: string | null;
  assignedAt?: string | null;
}

interface OrgPayload {
  organization: RawOrganization | null;
}

const mapOrganization = (raw: RawOrganization): Organization => ({
  id: raw.id,
  name: raw.name,
  description: raw.description ?? null,
  role: raw.role ?? null,
  status: (raw.status as OrgStatus) ?? 'active',
  assignedAt: raw.assignedAt ?? raw.assigned_at ?? null,
});

export const getMyOrganization = async (): Promise<Organization | null> => {
  const res = await http.get<Envelope<OrgPayload>>(Endpoints.profile.organization);
  const org = res.data.data.organization;
  return org ? mapOrganization(org) : null;
};
