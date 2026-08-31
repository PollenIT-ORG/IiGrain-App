import { useMemo, useRef, useState } from "react";
import { useAuth } from "../../store/useAuth";
import { useLiveData } from "../../lib/useLiveData";
import { showSuccess, showError } from "../../lib/toast";
import { useDialog } from "../ui/DialogProvider";
import Loader from "../Loader";
import DragScroll from "../ui/DragScroll";
import ModuleFormModal from "./ModuleFormModal";
import ModuleDocuments from "./ModuleDocuments";
import RecordDetailModal from "./RecordDetailModal";
import {
  MODULES,
  MODULE_BY_KEY,
  tableFields,
  STATUS_LABEL,
} from "../../lib/fieldModules";
import { exportModule, exportAllModules } from "../../lib/fieldModuleExport";
import {
  useGetFieldModulesQuery,
  useListModuleRecordsQuery,
  useListModuleDocumentsQuery,
  useDeleteModuleRecordMutation,
  useLazyListModuleRecordsQuery,
} from "../../store/endpoints/fieldMonitoringApi";
import type { ModuleKey, ModuleRecord, ModuleDocument } from "../../types";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

/** A farmer never reaches these screens, so everyone else here may edit. */
const EDITORS = ["super_admin", "admin", "program_administrator"];

function cellText(record: ModuleRecord, key: string, type: string): string {
  const raw = record[key];
  if (raw === null || raw === undefined || raw === "") return "-";
  if (type === "boolean") return raw === true ? "Yes" : "No";
  if (type === "date") {
    const d = new Date(String(raw));
    return Number.isNaN(d.getTime())
      ? String(raw)
      : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  }
  return String(raw);
}

export interface FieldMonitoringPanelProps {
  fieldId: string;
  /** Set to drive the tab from the URL; left out, the panel keeps its own. */
  tab?: ModuleKey;
  onTabChange?: (next: ModuleKey) => void;
  /** Shown as a card header above the tabs when this panel sits inside a page. */
  heading?: string;
}

/**
 * One field's monitoring record: the nine modules, their rows and their files.
 * Every record here belongs to this field alone, exports included.
 */
export default function FieldMonitoringPanel({
  fieldId,
  tab,
  onTabChange,
  heading,
}: FieldMonitoringPanelProps) {
  const { user } = useAuth();
  const { confirm } = useDialog();

  const [ownTab, setOwnTab] = useState<ModuleKey>(MODULES[0].key);
  const active = tab ?? ownTab;
  const module = MODULE_BY_KEY[active] ? active : MODULES[0].key;

  const [editing, setEditing] = useState<ModuleRecord | null>(null);
  const [viewing, setViewing] = useState<ModuleRecord | null>(null);
  const [adding, setAdding] = useState(false);
  const [exporting, setExporting] = useState<"tab" | "all" | null>(null);

  // State lags a render behind, so a second press lands before the button is
  // disabled. This is checked where the second press actually arrives.
  const running = useRef(false);

  const canEdit = EDITORS.includes(user?.role ?? "");

  const {
    data: summary,
    isLoading: loadingModules,
    isError,
    error,
    refetch,
  } = useGetFieldModulesQuery(fieldId, { skip: !fieldId });

  const {
    data: recordData,
    isLoading: firstLoad,
    isFetching: refreshing,
  } = useListModuleRecordsQuery({ fieldId, module }, { skip: !fieldId });

  const { data: documents = [] } = useListModuleDocumentsQuery(
    { fieldId },
    { skip: !fieldId }
  );

  const [remove] = useDeleteModuleRecordMutation();
  const [fetchRecords] = useLazyListModuleRecordsQuery();

  useLiveData(["fields"], refetch);

  const fields = useMemo(() => tableFields(module), [module]);
  const records = recordData?.records ?? [];
  const context = summary?.context ?? recordData?.context;

  const moduleDocs = useMemo(
    () => documents.filter((d) => d.module === module),
    [documents, module]
  );
  const filesByRecord = useMemo(() => {
    const map = new Map<string, ModuleDocument[]>();
    for (const d of moduleDocs) {
      if (!d.record_id) continue;
      map.set(d.record_id, [...(map.get(d.record_id) ?? []), d]);
    }
    return map;
  }, [moduleDocs]);

  function switchTab(next: ModuleKey) {
    if (onTabChange) onTabChange(next);
    else setOwnTab(next);
  }

  async function onDelete(record: ModuleRecord) {
    const def = MODULE_BY_KEY[module];
    const yes = await confirm({
      title: `Delete this ${def.singular.toLowerCase()}?`,
      message:
        "The record and any files attached to it will be removed. This cannot be undone.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!yes) return;
    try {
      await remove({ fieldId, module, id: record.id }).unwrap();
      showSuccess("Record deleted.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  /** This tab only, for this field. */
  async function onExportTab() {
    if (running.current) return;
    if (!context) return;
    if (!records.length) {
      showError(
        `There are no ${MODULE_BY_KEY[module].label.toLowerCase()} records on this field to export.`
      );
      return;
    }
    running.current = true;
    setExporting("tab");
    try {
      await exportModule({ module, records, documents: moduleDocs, context });
    } catch (err) {
      showError(errMsg(err));
    } finally {
      running.current = false;
      setExporting(null);
    }
  }

  /** Every module of this field in one workbook, the other eight fetched now. */
  async function onExportAll() {
    if (running.current) return;
    if (!context) return;
    running.current = true;
    setExporting("all");
    try {
      const byModule = {} as Record<ModuleKey, ModuleRecord[]>;
      let total = 0;
      for (const def of MODULES) {
        const rows =
          def.key === module
            ? records
            : (await fetchRecords({ fieldId, module: def.key }, true).unwrap())
                .records;
        byModule[def.key] = rows;
        total += rows.length;
      }
      if (total === 0) {
        showError(
          `${context.fieldName} has no monitoring records yet, so there is nothing to export.`
        );
        return;
      }
      await exportAllModules({ recordsByModule: byModule, documents, context });
      showSuccess("Field workbook downloaded.");
    } catch (err) {
      showError(errMsg(err));
    } finally {
      running.current = false;
      setExporting(null);
    }
  }

  if (loadingModules) {
    return (
      <div className="card overflow-hidden">
        <Loader message="Loading field records..." />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="card px-5 py-16 text-center text-sm text-gray-500">
        {errMsg(error)}
      </div>
    );
  }

  const def = MODULE_BY_KEY[module];

  return (
    <>
      <div className="card overflow-hidden">
        {heading && (
          <div className="border-b border-gray-300 px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              {heading}
            </h2>
          </div>
        )}

        {/* Tabs scroll sideways rather than wrapping, and can be dragged. */}
        <DragScroll className="overflow-x-auto border-b border-gray-300">
          <div className="flex min-w-max">
            {MODULES.map((m) => {
              const count = summary?.modules.find((s) => s.module === m.key);
              const on = m.key === module;
              return (
                <button
                  key={m.key}
                  onClick={() => switchTab(m.key)}
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

        <div className="flex flex-col gap-3 border-b border-gray-300 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{def.label} Records</h3>
            <p className="text-xs text-gray-500">
              {records.length} record{records.length === 1 ? "" : "s"} on this field
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void onExportTab()}
              disabled={exporting !== null}
              className="btn-secondary py-2 text-sm"
            >
              {exporting === "tab" ? "Preparing..." : `Export ${def.label}`}
            </button>
            <button
              onClick={() => void onExportAll()}
              disabled={exporting !== null}
              className="btn-secondary py-2 text-sm"
            >
              {exporting === "all" ? "Preparing..." : "Export Full Field"}
            </button>
            {canEdit && (
              <button
                onClick={() => setAdding(true)}
                className="btn-primary py-2 text-sm"
              >
                + Add {def.singular}
              </button>
            )}
          </div>
        </div>

        {firstLoad ? (
          <Loader message={`Loading ${def.label.toLowerCase()}...`} />
        ) : records.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-gray-500">
            No {def.label.toLowerCase()} records yet for this field.
          </div>
        ) : (
          <DragScroll className="overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead>
                <tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-500">
                  {fields.map((f) => (
                    <th key={f.key} className="whitespace-nowrap px-4 py-3 font-semibold">
                      {f.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Attachments</th>
                  {canEdit && (
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className={refreshing ? "opacity-60 transition-opacity" : ""}>
                {records.map((r) => {
                  const files = filesByRecord.get(r.id) ?? [];
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setViewing(r)}
                      className="cursor-pointer border-b border-gray-300/70 last:border-0 hover:bg-gray-100/60"
                      title="Open this record"
                    >
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
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewing(r);
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ${
                            files.length
                              ? "text-primary hover:bg-primary/10"
                              : "text-gray-400 hover:bg-gray-100 hover:text-primary"
                          }`}
                          title={
                            files.length
                              ? `${files.length} file${files.length === 1 ? "" : "s"}`
                              : "Attach a file"
                          }
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                          </svg>
                          {files.length || "Add"}
                        </button>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditing(r);
                              }}
                              className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-primary"
                              title="Edit"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void onDelete(r);
                              }}
                              className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-danger"
                              title="Delete"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DragScroll>
        )}

        <div className="border-t border-gray-300 p-4">
          <ModuleDocuments
            fieldId={fieldId}
            module={module}
            documents={moduleDocs}
            canEdit={canEdit}
          />
        </div>
      </div>

      {viewing && !editing && (
        <RecordDetailModal
          module={module}
          fieldId={fieldId}
          record={viewing}
          canEdit={canEdit}
          onEdit={() => {
            setEditing(viewing);
            setViewing(null);
          }}
          onClose={() => setViewing(null)}
        />
      )}

      {(adding || editing) && (
        <ModuleFormModal
          module={module}
          fieldId={fieldId}
          record={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
