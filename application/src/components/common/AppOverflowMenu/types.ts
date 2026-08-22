export interface OverflowMenuItem {
  key: string;
  icon: string;
  title: string;
  onPress: () => void;
  destructive?: boolean;
  loading?: boolean;
  disabled?: boolean;
  description?: string;
}

export interface AppOverflowMenuProps {
  items: OverflowMenuItem[];
  color?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
}
