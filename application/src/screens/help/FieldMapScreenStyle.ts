import { StyleSheet } from 'react-native';
import { COLORS } from '../../constants';

/**
 * The screen is a header plus a full-bleed `MapExplorer`, so all it owns is the
 * page shell. Every map-surface style — search box, results panel, base-map
 * switcher, controls, detail card, empty state — lives inside
 * `src/maps/components/MapExplorer.tsx`, so that a second consumer of the
 * component inherits the exact same look without copying a stylesheet.
 */
export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
});
