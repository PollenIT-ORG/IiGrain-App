import { useLocation, useNavigate } from "react-router-dom";
import type { Crumb } from "../components/ui/Breadcrumbs";

export interface ReturnState {
  from: string;
  fromState?: unknown;
  trail?: Crumb[];
}

function isAppPath(path: unknown): path is string {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//");
}

function readReturn(state: unknown): ReturnState | null {
  const saved = state as Partial<ReturnState> | null;
  if (!isAppPath(saved?.from)) return null;
  return { from: saved.from, fromState: saved.fromState };
}

export function useHere(): ReturnState {
  const { pathname, search, state } = useLocation();
  return { from: pathname + search, fromState: state };
}

export function useReturnTo(fallback: string): {
  path: string;
  state: unknown;
  go: () => void;
} {
  const navigate = useNavigate();
  const { state } = useLocation();
  const saved = readReturn(state);
  const path = saved?.from ?? fallback;
  return {
    path,
    state: saved?.fromState,
    go: () => navigate(path, { state: saved?.fromState }),
  };
}

export function useTrail(): Crumb[] | null {
  const { state } = useLocation();
  const trail = (state as Partial<ReturnState> | null)?.trail;
  if (!Array.isArray(trail) || trail.length === 0) return null;
  const valid = trail.every(
    (c: Partial<Crumb>) =>
      typeof c?.label === "string" && (c.to === undefined || isAppPath(c.to))
  );
  return valid ? trail : null;
}

export function useForward(crumbs: Crumb[]): ReturnState {
  const { pathname, search, state } = useLocation();
  const from = pathname + search;
  const current = crumbs[crumbs.length - 1];
  return {
    from,
    fromState: state,
    trail: [
      ...crumbs.slice(0, -1),
      { label: current?.label ?? "", to: from, state },
    ],
  };
}
