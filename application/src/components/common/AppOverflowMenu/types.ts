export interface OverflowMenuItem {
  /** Stable identity — also used as the React key. */
  key: string;
  /** Icon name resolved through the central `AppIcon` registry. */
  icon: string;
  title: string;
  onPress: () => void;
  /** Renders in the danger tone; use for destructive actions. */
  destructive?: boolean;
  /** Swaps the icon for a spinner and blocks presses on this row only. */
  loading?: boolean;
  disabled?: boolean;
  /** Optional second line, e.g. why the item is disabled. */
  description?: string;
}

export interface AppOverflowMenuProps {
  items: OverflowMenuItem[];
  /** Tint for the trigger glyph. Defaults to the header's white. */
  color?: string;
  accessibilityLabel?: string;
  /** Hides the trigger entirely — useful while the screen is still loading. */
  disabled?: boolean;
}
