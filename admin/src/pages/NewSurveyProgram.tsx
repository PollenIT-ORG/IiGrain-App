import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useListProgramsQuery } from "../store/endpoints/programsApi";
import { useListPasProgramsQuery } from "../store/endpoints/programAdminSurveyApi";
import { errMsg } from "../lib/errMsg";
import { useLiveData } from "../lib/useLiveData";
import Loader from "../components/Loader";
import ProgramStatusBadge from "../components/ProgramStatusBadge";
import { PlusIcon, ChevronLeftIcon, ChevronRightIcon } from "../components/icons";

// A survey is answered for a program, so a new one starts by saying which
// program it is for. A program that already has a survey is not offered - its
// survey is changed from the program itself.

export default function NewSurveyProgram() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, error, refetch } = useListProgramsQuery({
    page: 1,
    limit: 100,
  });
  const { data: links, refetch: refetchLinks } = useListPasProgramsQuery();
  useLiveData(["programs", "program_admin_survey"], () => {
    void refetch();
    void refetchLinks();
  });

  const taken = useMemo(
    () =>
      new Set(
        (links ?? [])
          .map((l) => l.program_id)
          .filter((v): v is string => Boolean(v))
      ),
    [links]
  );

  const programs = data?.programs ?? [];
  const free = useMemo(
    () =>
      programs.filter(
        (p) =>
          !taken.has(p.id) &&
          (!search.trim() ||
            p.name.toLowerCase().includes(search.trim().toLowerCase()))
      ),
    [programs, taken, search]
  );

  if (isLoading) return <Loader variant="fullPage" message="Loading programs..." />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <button
          onClick={() => navigate("/surveys")}
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-primary"
        >
          <ChevronLeftIcon width={16} height={16} />
          Back to surveys
        </button>
        <h1 className="text-2xl font-bold text-gray-900">New survey</h1>
        <p className="mt-1 text-sm text-gray-500">
          Choose the program this survey is for. Its questions and contract come
          next.
        </p>
      </div>

      {isError ? (
        <div className="card px-5 py-16 text-center text-sm text-gray-500">
          {errMsg(error)}
        </div>
      ) : programs.length === 0 ? (
        // Nothing to attach a survey to yet: the program comes first.
        <div className="card space-y-4 px-5 py-14 text-center">
          <p className="text-sm font-semibold text-gray-900">
            You have no programs yet.
          </p>
          <p className="mx-auto max-w-md text-sm text-gray-500">
            A survey belongs to a program - it is how producers apply to it. Add
            the program first, then build its survey.
          </p>
          <button
            className="btn-primary mx-auto"
            onClick={() => navigate("/programs/new")}
          >
            <PlusIcon width={18} height={18} />
            Add a program
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="border-b border-gray-300 p-4">
            <input
              className="input-field"
              placeholder="Search programs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={100}
            />
          </div>
          {free.length === 0 ? (
            <div className="space-y-4 px-5 py-14 text-center">
              <p className="text-sm font-semibold text-gray-900">
                Every program already has a survey.
              </p>
              <p className="mx-auto max-w-md text-sm text-gray-500">
                Open a program to change its survey, or add a new program to
                build another one.
              </p>
              <button
                className="btn-primary mx-auto"
                onClick={() => navigate("/programs/new")}
              >
                <PlusIcon width={18} height={18} />
                Add a program
              </button>
            </div>
          ) : (
            <ul>
              {free.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => navigate(`/programs/${p.id}/survey`)}
                    className="flex w-full items-center gap-4 border-b border-gray-300/70 px-5 py-4 text-left last:border-0 hover:bg-gray-100/60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-gray-900">
                        {p.name}
                      </span>
                      {p.code && (
                        <span className="block text-xs text-gray-500">
                          {p.code}
                        </span>
                      )}
                    </span>
                    <ProgramStatusBadge program={p} />
                    <ChevronRightIcon
                      width={16}
                      height={16}
                      className="shrink-0 text-gray-400"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
