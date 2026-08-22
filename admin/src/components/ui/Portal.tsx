import { createPortal } from "react-dom";
import type { ReactNode } from "react";

// Renders children at the end of <body> so overlays escape any ancestor
// stacking context or overflow (e.g. the scrolling main area) and reliably
// cover the whole viewport - header and sidebar included.
export default function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
