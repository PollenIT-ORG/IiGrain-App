import type { StatusKind } from '../AppStatusBadge/AppStatusBadge';

export interface AccountInfoItem {
  id: string;
  icon: string;
  label: string;
  value?: string;
  badge?: {
    status: StatusKind;
    label?: string;
  };
  muted?: boolean;
}
