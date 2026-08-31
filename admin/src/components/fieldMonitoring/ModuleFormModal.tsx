import { useMemo, useState, type FormEvent } from "react";
import Portal from "../ui/Portal";
import Select from "../ui/Select";
import Toggle from "../ui/Toggle";
import { showSuccess, showError } from "../../lib/toast";
import { allFields, MODULE_BY_KEY, type ModuleField } from "../../lib/fieldModules";
import {
  useCreateModuleRecordMutation,
  useUpdateModuleRecordMutation,
} from "../../store/endpoints/fieldMonitoringApi";
import type { ModuleKey, ModuleRecord, ModuleStatus } from "../../types";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

/** A date column arrives as an ISO timestamp and an input wants YYYY-MM-DD. */
function toDateInput(value: unknown): string {
  if (!value) return "";
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : "";
}

function initialValues(
  module: ModuleKey,
  record: ModuleRecord | null
): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const f of allFields(module)) {
    const raw = record?.[f.key];
    if (f.type === "boolean") out[f.key] = raw === true;
    else if (f.type === "date") out[f.key] = toDateInput(raw);
    else out[f.key] = raw === null || raw === undefined ? "" : String(raw);
  }
  out.notes = record?.notes ?? "";
  return out;
}

/**
 * Add or edit a record in any of the nine modules.
 *
 * The form is built from the column registry rather than written nine times,
 * so a column added there appears here with its own type, limits and options
 * and nothing else has to change.
 */
export default function ModuleFormModal({
  module,
  fieldId,
  record,
  onClose,
}: {
  module: ModuleKey;
  fieldId: string;
  /** Null when adding. */
  record: ModuleRecord | null;
  onClose: () => void;
}) {
  const def = MODULE_BY_KEY[module];
  const fields = useMemo(() => allFields(module), [module]);

  const [values, setValues] = useState(() => initialValues(module, record));
  const [status, setStatus] = useState<ModuleStatus>(
    (record?.status as ModuleStatus) ?? "in_progress"
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [create, { isLoading: creating }] = useCreateModuleRecordMutation();
  const [update, { isLoading: updating }] = useUpdateModuleRecordMutation();
  const saving = creating || updating;

  function set(key: string, value: string | boolean) {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  }

  /**
   * The same rules the server enforces, checked here so the message lands under
   * the input instead of arriving as a failed save.
   */
  function validate(): boolean {
    const next: Record<string, string> = {};

    for (const f of fields) {
      const raw = values[f.key];
      if (f.required && (raw === "" || raw === undefined)) {
        next[f.key] = `${f.label} is required.`;
        continue;
      }
      if (raw === "" || raw === undefined || typeof raw === "boolean") continue;

      if (f.type === "number") {
        const n = Number(raw);
        if (Number.isNaN(n)) next[f.key] = `${f.label} must be a number.`;
        else if (f.min !== undefined && n < f.min)
          next[f.key] = `${f.label} cannot be less than ${f.min}.`;
        else if (f.max !== undefined && n > f.max)
          next[f.key] = `${f.label} cannot be more than ${f.max}.`;
      }
      if (f.maxLength && String(raw).length > f.maxLength) {
        next[f.key] = `${f.label} is too long (limit ${f.maxLength}).`;
      }
    }

    // The one cross-field rule: a crop cannot be harvested before it is planted.
    const planted = values.planting_date;
    const harvested = values.harvest_date;
    if (
      typeof planted === "string" &&
      typeof harvested === "string" &&
      planted &&
      harvested &&
      harvested < planted
    ) {
      next.harvest_date = "Harvest date cannot be before the planting date.";
    }

    if (String(values.notes ?? "").length > 1000) {
      next.notes = "Notes are too long (limit 1000).";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  /** Blanks are sent as null so a cleared field is actually cleared. */
  function payload(): Record<string, unknown> {
    const body: Record<string, unknown> = { status };
    for (const f of fields) {
      const raw = values[f.key];
      if (f.type === "boolean") body[f.key] = Boolean(raw);
      else if (raw === "" || raw === undefined) body[f.key] = null;
      else if (f.type === "number") body[f.key] = Number(raw);
      else body[f.key] = raw;
    }
    body.notes = String(values.notes ?? "").trim() || null;
    return body;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    try {
      if (record) {
        await update({
          fieldId,
          module,
          id: record.id,
          body: payload(),
        }).unwrap();
        showSuccess(`${def.singular} updated.`);
      } else {
        await create({ fieldId, module, body: payload() }).unwrap();
        showSuccess(`${def.singular} added.`);
      }
      onClose();
    } catch (err) {
      showError(errMsg(err));
    }
  }

  function renderInput(f: ModuleField) {
    const value = values[f.key];
    const bad = Boolean(errors[f.key]);

    if (f.type === "boolean") {
      return (
        <div className="flex items-center gap-3 pt-1">
          <Toggle
            checked={value === true}
            onChange={(next) => set(f.key, next)}
            label={f.label}
          />
          <span className="text-sm text-gray-700">
            {value === true ? "Yes" : "No"}
          </span>
        </div>
      );
    }

    if (f.type === "select") {
      return (
        <Select
          id={f.key}
          value={String(value ?? "")}
          onChange={(v) => set(f.key, v)}
          options={[
            { value: "", label: "Select..." },
            ...(f.options ?? []).map((o) => ({ value: o, label: o })),
          ]}
          error={bad}
          searchable={(f.options?.length ?? 0) > 8}
        />
      );
    }

    if (f.type === "textarea") {
      return (
        <textarea
          id={f.key}
          rows={3}
          className={`input-field resize-none ${bad ? "input-error" : ""}`}
          maxLength={f.maxLength}
          value={String(value ?? "")}
          onChange={(e) => set(f.key, e.target.value)}
        />
      );
    }

    return (
      <input
        id={f.key}
        type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
        className={`input-field ${bad ? "input-error" : ""}`}
        placeholder={f.placeholder}
        maxLength={f.type === "text" ? f.maxLength : undefined}
        min={f.min}
        max={f.max}
        step={f.step}
        value={String(value ?? "")}
        onChange={(e) => set(f.key, e.target.value)}
      />
    );
  }

  return (
    <Portal>
      <div className="modal-overlay" onMouseDown={onClose}>
        <div
          className="modal-panel card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6 sm:p-7"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-lg font-bold text-gray-900">
              {record ? `Edit ${def.singular}` : `Add ${def.singular}`}
            </h2>
            <button
              onClick={onClose}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                  <label htmlFor={f.key} className="label">
                    {f.label}
                    {f.required && <span className="text-danger"> *</span>}
                  </label>
                  {renderInput(f)}
                  {errors[f.key] ? (
                    <p className="field-error">{errors[f.key]}</p>
                  ) : f.hint ? (
                    <p className="mt-1 text-xs text-gray-500">{f.hint}</p>
                  ) : null}
                </div>
              ))}
            </div>

            <div>
              <label htmlFor="notes" className="label">Notes</label>
              <textarea
                id="notes"
                rows={2}
                maxLength={1000}
                className={`input-field resize-none ${errors.notes ? "input-error" : ""}`}
                placeholder="Optional"
                value={String(values.notes ?? "")}
                onChange={(e) => set("notes", e.target.value)}
              />
              {errors.notes && <p className="field-error">{errors.notes}</p>}
            </div>

            {/* Progress is per record: the module list counts the completed ones. */}
            <div className="rounded-lg border border-gray-300 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Mark as completed
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Completed records are what the module count reports.
                  </p>
                </div>
                <Toggle
                  checked={status === "completed"}
                  onChange={(next) => setStatus(next ? "completed" : "in_progress")}
                  label="Mark this record as completed"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={onClose} className="btn-secondary py-2.5">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary py-2.5">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
