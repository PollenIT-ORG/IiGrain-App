import type { SVGProps } from "react";
import {
  mdiSprout,
  mdiWaterOutline,
  mdiLeaf,
  mdiTractorVariant,
  mdiSproutOutline,
  mdiSprayBottle,
  mdiGrass,
  mdiTree,
  mdiClipboardTextOutline,
  mdiWeatherSunny,
  mdiBarley,
} from "@mdi/js";

type IconProps = SVGProps<SVGSVGElement>;

// Material Design Icons - the same set the mobile app renders through
// react-native-vector-icons/MaterialCommunityIcons, so the survey category
// glyphs here match the app 1:1. MDI paths are filled, drawn on a 24x24 grid.
function Mdi({ path, ...props }: { path: string } & IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d={path} />
    </svg>
  );
}

const MAP: Record<string, string> = {
  soil: mdiSprout,
  water: mdiWaterOutline,
  nutrient: mdiLeaf,
  tillage: mdiTractorVariant,
  crop: mdiSproutOutline,
  pest: mdiSprayBottle,
  cover: mdiGrass,
  habitat: mdiTree,
  record: mdiClipboardTextOutline,
  // Extra options offered in the category icon picker.
  sun: mdiWeatherSunny,
  wheat: mdiBarley,
  tree: mdiTree,
};

// The icons an admin can pick for a category. Falls back to the sprout when a
// category has no icon set.
export const CATEGORY_ICON_KEYS: string[] = [
  "soil",
  "crop",
  "water",
  "nutrient",
  "pest",
  "tillage",
  "habitat",
  "cover",
  "record",
  "wheat",
  "sun",
];

export function CategoryIcon({
  icon,
  ...props
}: { icon: string | null } & IconProps) {
  const path = (icon && MAP[icon]) || mdiSprout;
  return <Mdi path={path} {...props} />;
}

// Per-icon accent + soft background, so categories read in colour the way the
// mobile app shows them (water blue, tillage amber, pest purple, the rest
// green) instead of a single flat green.
const COLOR: Record<string, { fg: string; bg: string }> = {
  soil: { fg: "#2f9e63", bg: "#e8f4ed" },
  water: { fg: "#3f93d4", bg: "#e6f1f9" },
  nutrient: { fg: "#2f9e63", bg: "#e8f4ed" },
  tillage: { fg: "#cf8a2f", bg: "#f6ead7" },
  crop: { fg: "#2f9e63", bg: "#e8f4ed" },
  pest: { fg: "#9257c4", bg: "#f1e8f8" },
  cover: { fg: "#2f9e63", bg: "#e8f4ed" },
  habitat: { fg: "#2f9e63", bg: "#e8f4ed" },
  record: { fg: "#cf9a2f", bg: "#f6f0d9" },
  wheat: { fg: "#cf8a2f", bg: "#f6ead7" },
  sun: { fg: "#e0a21a", bg: "#fbf2d6" },
};

export function categoryColor(icon: string | null): { fg: string; bg: string } {
  return (icon && COLOR[icon]) || COLOR.soil;
}

// A ready-made coloured chip around a category icon. Size and shape come from
// className (h/w/rounded), the colour from the icon key.
export function CategoryIconChip({
  icon,
  size = 22,
  className = "",
}: {
  icon: string | null;
  size?: number;
  className?: string;
}) {
  const { fg, bg } = categoryColor(icon);
  return (
    <span
      className={`grid place-items-center ${className}`}
      style={{ backgroundColor: bg, color: fg }}
    >
      <CategoryIcon icon={icon} width={size} height={size} />
    </span>
  );
}
