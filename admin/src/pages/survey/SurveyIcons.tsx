import type { ComponentType, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Leaf(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}
function Water(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7Z" />
    </svg>
  );
}
function Tractor(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="7" cy="17" r="3" /><circle cx="18" cy="17.5" r="2.5" />
      <path d="M4 14V8h5l2 4h3M11 8V5h4v3M14 12h4v3" />
    </svg>
  );
}
function Flask(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 3h6M10 3v6l-5 8a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-8V3" /><path d="M7 15h10" />
    </svg>
  );
}
function Tree(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 22v-6M8 16a4 4 0 0 1-2-7.5A4.5 4.5 0 0 1 12 3a4.5 4.5 0 0 1 6 5.5A4 4 0 0 1 16 16Z" />
    </svg>
  );
}
function Clipboard(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="8" y="3" width="8" height="4" rx="1" /><path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 12h6M9 16h4" />
    </svg>
  );
}

const MAP: Record<string, ComponentType<IconProps>> = {
  soil: Leaf,
  water: Water,
  nutrient: Flask,
  tillage: Tractor,
  crop: Leaf,
  pest: Flask,
  cover: Leaf,
  habitat: Tree,
  record: Clipboard,
};

export function CategoryIcon({
  icon,
  ...props
}: { icon: string | null } & IconProps) {
  const Component = (icon && MAP[icon]) || Leaf;
  return <Component {...props} />;
}
