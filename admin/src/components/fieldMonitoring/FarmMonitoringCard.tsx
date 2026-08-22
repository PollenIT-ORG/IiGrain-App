import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Loader from "../Loader";
import Select from "../ui/Select";
import DragScroll from "../ui/DragScroll";
import { showError } from "../../lib/toast";
import { useFarmWorkbook } from "../../lib/useFarmWorkbook";
import {
  MODULES,
  MODULE_BY_KEY,
  tableFields,
  STATUS_LABEL,
} from "../../lib/fieldModules";
import { moduleSheetColumns, moduleSheetRow } from "../../lib/fieldModuleExport";
import { downloadWorkbook, fileStamp } from "../../lib/workbook";
import {
  useGetFarmProgramsQuery,
  useGetFarmModulesQuery,
  useListFarmRecordsQuery,
} from "../../store/endpoints/fieldMonitoringApi";
import type { ModuleKey, ModuleRecord } from "../../types";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

function cellText(record: ModuleRecord, key: string, type: string): string {
  const raw = record[key];
  if (raw === null || raw === undefined || raw === "") return "-";
  if (type === "boolean") return raw === true ? "Yes" : "No";
  if (type === "date") {
    const d = new Date(String(raw));
    return Number.isNaN(d.getTime())
      ? String(raw)
      : d.toLocaleDateString(undefined, {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
  }
  return String(raw);
}

/**
 * The farm's monitoring record, on the farm itself.
 *
 * The same nine tabs the client's workbook has, but covering the whole farm at
 * once rather than one field. Every row names its field, which is the only real
 * difference from the per-field screen.
 *
 * Reading here, writing on the field. A record belongs to one field, so adding
 * and editing stay where that is unambiguous; the field name in each row is a
 * link through to it.
 */
export default function FarmMonitoringCard({ farmId }: { farmId: string }) {
  const navigate = useNavigate();
  const [module, setModule] = useState<ModuleKey>(MODULES[0].key);
  const [programId, setProgramId] = useState("");
  const [exportingTab, setExportingTab] = useState(false);
  const { download, busyFarmId } = useFarmWorkbook();

  const { data: farmPrograms, isLoading: loadingPrograms } =
    useGetFarmProgramsQuery(farmId, { skip: !farmId });

  const programs = useMemo(() => farmPrograms?.programs ?? [], [farmPrograms]);

  // The newest program is the one most likely being worked on.
  useEffect(() => {
    if (!programId && programs.length) setProgramId(programs[0].programId);
  }, [programs, programId]);

  const program = programs.find((p) => p.programId === programId);

  const { data: summary } = useGetFarmModulesQuery(
    { farmId, programId },
    { skip: !farmId || !programId }
  );

  const {
    data: recordData,
    isLoading: firstLoad,
    isFetching: refreshing,
  } = useListFarmRecordsQuery(
    { farmId, programId, module },
    { skip: !farmId || !programId }
  );

  const fields = useMemo(() => tableFields(module), [module]);
  const records = recordData?.records ?? [];
  const def = MODULE_BY_KEY[module];

  /** This tab only, for this farm, as its own sheet. */
  async function exportTab() {
    if (!program || !farmPrograms) return;
    setExportingTab(true);
    try {
      const all = MODULE_BY_KEY[module].fields;
      const clean = (s: string) =>
        s.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
      await downloadWorkbook(
        `${clean(farmPrograms.farmName)}-${clean(def.label)}-${fileStamp()}.xlsx`,
        [
          {
            name: def.sheetName.slice(0, 31),
            title: `${def.label} - ${farmPrograms.farmName}`,
            subtitle: program.programName,
            notes: [
              ["Farm ID", farmPrograms.farmName],
              ["Program", program.programName],
              ["Records", String(records.length)],
            ],
            columns: [
              { header: "Field Name", width: 24, type: "text" },
              ...moduleSheetColumns(module),
            ],
            rows: records.map((r) => [
              r.field_name,
              ...moduleSheetRow(r, all, []),
            ]),
          },
        ]
      );
    } catch (err) {
      showError(errMsg(err));
    } finally {
      setExportingTab(false);
    }
  }

  if (loadingPrograms) return null;

  if (!programs.length) {
    return (
      <div className="card overflow-hidden">
        <div className="border-b border-gray-300 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Field Monitoring
          </h2>
        </div>
        <div className="px-5 py-10 text-center text-sm text-gray-500">
          None of this farm's fields are enrolled in a program yet.
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-gray-300 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Field Monitoring
          </h2>
          {program && (
            <p className="mt-0.5 text-xs text-gray-500">
              {program.fields.length} field
              {program.fields.length === 1 ? "" : "s"} enrolled
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Only shown when there is a choice to make. */}
          {programs.length > 1 && (
            <Select
              value={programId}
              onChange={setProgramId}
              options={programs.map((p) => ({
                value: p.programId,
                label: p.programName,
              }))}
              className="w-56"
            />
          )}
          <button
            onClick={() => void exportTab()}
            disabled={exportingTab}
            className="btn-secondary py-2 text-sm"
          >
            {exportingTab ? "Preparing..." : `Export ${def.label}`}
          </button>
          <button
            onClick={() => void download(farmId)}
            disabled={busyFarmId === farmId}
            className="btn-primary py-2 text-sm"
          >
            {busyFarmId === farmId ? "Preparing..." : "Export Full Farm"}
          </button>
        </div>
      </div>

      {/* The nine tabs, mirroring the sheets in the client's workbook. */}
      <DragScroll className="overflow-x-auto border-b border-gray-300">
        <div className="flex min-w-max">
          {MODULES.map((m) => {
            const count = summary?.modules.find((s) => s.module === m.key);
            const on = m.key === module;
            return (
              <button
                key={m.key}
                onClick={() => setModule(m.key)}
                className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  on
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-900"
                }`}
              >
                {m.label}
                {count && count.total > 0 && (
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                      on ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {count.completed}/{count.total}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </DragScroll>

      {firstLoad ? (
        <Loader message={`Loading ${def.label.toLowerCase()}...`} />
      ) : records.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-gray-500">
          No {def.label.toLowerCase()} records on this farm yet.
        </div>
      ) : (
        <DragScroll className="overflow-x-auto">
          <table className="w-full min-w-max text-left text-sm">
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3 font-semibold">Field</th>
                {fields.map((f) => (
                  <th key={f.key} className="whitespace-nowrap px-4 py-3 font-semibold">
                    {f.label}
                  </th>
                ))}
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className={refreshing ? "opacity-60 transition-opacity" : ""}>
              {records.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-gray-300/70 last:border-0 hover:bg-gray-100/60"
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    <button
                      onClick={() =>
                        navigate(
                          `/programs/${programId}/fields/${r.field_id}/monitoring?tab=${module}`
                        )
                      }
                      className="font-medium text-primary hover:underline"
                      title="Open this field's records"
                    >
                      {r.field_name}
                    </button>
                  </td>
                  {fields.map((f) => (
                    <td key={f.key} className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {cellText(r, f.key, f.type)}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                        r.status === "completed"
                          ? "bg-primary/10 text-primary"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DragScroll>
      )}
    </div>
  );
}
