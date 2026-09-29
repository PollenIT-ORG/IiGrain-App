import { useGetProgramQuery } from "../store/endpoints/programsApi";
import { useReturnTo } from "./returnTo";
import type { Crumb } from "../components/ui/Breadcrumbs";

export function useProgramCrumbs(programId: string | undefined): Crumb[] {
  const home = `/programs/${programId ?? ""}`;
  const back = useReturnTo(home);
  const { data: program } = useGetProgramQuery(programId ?? "", {
    skip: !programId,
  });
  if (!programId) return [];
  const backPath = back.path.split("?")[0];
  const returns = backPath === home || backPath === `${home}/edit`;
  return [
    { label: "Programs", to: "/programs" },
    {
      label: program?.name ?? "Program",
      to: returns ? back.path : home,
      state: returns ? back.state : undefined,
    },
  ];
}
