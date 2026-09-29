import { useEffect, useRef } from "react";
import { getSocket } from "./socket";

export type ChangedResource =
  | "enrollments"
  | "submissions"
  | "visits"
  | "assignments"
  | "dashboard"
  | "farms"
  | "fields"
  | "users"
  | "programs"
  | "organizations"
  | "survey_questions"
  | "program_admin_survey"
  | "assessments";

export function useLiveData(
  resources: ChangedResource[],
  refetch: () => void
): void {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  const key = resources.join(",");

  useEffect(() => {
    const socket = getSocket();
    const wanted = new Set(key.split(","));
    const onChange = (payload: { resource?: string }) => {
      if (payload?.resource && wanted.has(payload.resource)) {
        refetchRef.current();
      }
    };
    socket.on("data:changed", onChange);
    return () => {
      socket.off("data:changed", onChange);
    };
  }, [key]);
}
