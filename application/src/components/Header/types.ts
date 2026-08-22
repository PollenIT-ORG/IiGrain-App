import type { ReactNode } from 'react';

export type HeaderVariant = 'logo' | 'title' | 'back' | 'custom';

export type HeaderAction =
  | 'notification'
  | 'profile'
  | 'search'
  | 'filter'
  | 'add'
  | 'edit';

export interface AppHeaderProps {
  variant?: HeaderVariant;
  title?: string;
  showDrawer?: boolean;
  rightActions?: HeaderAction[] | null;
  onActionPress?: (action: HeaderAction) => void;
  onBack?: () => void;
  centerComponent?: ReactNode;
  leftComponent?: ReactNode;
  rightComponent?: ReactNode;
  bgColor?:boolean
}
