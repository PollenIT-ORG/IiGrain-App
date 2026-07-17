export type OrgStatus = 'active' | 'inactive';

export interface Organization {
  id: string;
  name: string;
  description: string | null;
  role: string | null;
  status: OrgStatus;
  assignedAt: string | null;
}
