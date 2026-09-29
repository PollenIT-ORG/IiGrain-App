import { useParams } from "react-router-dom";

export interface ProgramScope {
  programId: string | undefined;
  to: (path: string) => string;
  home: (path: string) => string;
}

export function scopeFor(programId: string | undefined): ProgramScope {
  const base = programId ? `/programs/${programId}` : "";
  return {
    programId,
    to: (path) => `${base}${path}`,
    home: (path) => base || path,
  };
}

export function useProgramScope(): ProgramScope {
  const { programId } = useParams();
  return scopeFor(programId);
}

export function unscopedPath(path: string): string {
  return path.replace(
    /^\/programs\/[^/]+(?=\/(survey-submissions|fields|assessments)(\/|$))/,
    ""
  );
}
