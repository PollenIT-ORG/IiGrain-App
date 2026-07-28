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
  /**
   * Custom right-hand content, rendered after any `rightActions` icons.
   * Use for controls the fixed `HeaderAction` set cannot express — an overflow
   * menu, a filter chip, a text button.
   */
  rightComponent?: ReactNode;
  bgColor?:boolean
}
