import { useRef, useState } from "react";
import Portal from "./ui/Portal";
import { downloadApiFile } from "../lib/downloadApiFile";
import { FileIcon, UploadIcon } from "./icons";

// The server takes spreadsheets up to this size.
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const NAME_MAX = 150;

/**
 * A template built from a spreadsheet: the admin names it first, then picks the
 * file. Whether it is multiple choice or input based comes from the file itself.
 */
export default function TemplateImportModal({
  saving,
  onImport,
  onClose,
}: {
  saving: boolean;
  onImport: (name: string, file: File) => void;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ name?: string; file?: string }>({});

  function pickFile(chosen: File | undefined) {
    if (!chosen) return;
    if (!/\.(xlsx|xls)$/i.test(chosen.name)) {
      setErrors((e) => ({ ...e, file: "Choose an Excel file (.xlsx or .xls)." }));
      return;
    }
    if (chosen.size > MAX_IMPORT_BYTES) {
      setErrors((e) => ({ ...e, file: "This file is larger than 5 MB. Split it into smaller files." }));
      return;
    }
    setFile(chosen);
    setErrors((e) => ({ ...e, file: undefined }));
  }

  function handleImport() {
    const trimmed = name.trim();
    const next: { name?: string; file?: string } = {};
    if (trimmed.length < 2) next.name = "Give the template a name of at least two characters.";
    else if (trimmed.length > NAME_MAX) next.name = `The name must be ${NAME_MAX} characters or fewer.`;
    if (!file) next.file = "Choose the Excel file to import.";
    setErrors(next);
    if (next.name || next.file || !file) return;
    onImport(trimmed, file);
  }

  return (
    <Portal>
      <div className="modal-overlay" onMouseDown={onClose}>
        <div
          className="modal-panel card w-full max-w-lg p-6 sm:p-7"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg font-bold text-gray-900">Import an assessment from Excel</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Name the template first, then pick the file. Whether it is multiple choice or input based
            is read from the file.
          </p>

          <div className="mt-5">
            <label className="label" htmlFor="import-template-name">
              Template name <span className="text-danger">*</span>
            </label>
            <input
              id="import-template-name"
              className={`input-field ${errors.name ? "input-error" : ""}`}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder="e.g. Kharif field monitoring"
              maxLength={NAME_MAX}
              autoFocus
            />
            {errors.name && <p className="field-error">{errors.name}</p>}
          </div>

          <div className="mt-4">
            <label className="label">
              Excel file <span className="text-danger">*</span>
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary"
            >
              {file ? <FileIcon width={16} height={16} /> : <UploadIcon width={16} height={16} />}
              <span className="truncate">{file ? file.name : "Choose an .xlsx or .xls file"}</span>
            </button>
            {errors.file && <p className="field-error">{errors.file}</p>}
            <p className="mt-2 text-xs text-gray-500">
              Nothing to start from? Download an empty one:{" "}
              {(["mcq", "input"] as const).map((kind, index) => (
                <span key={kind}>
                  {index > 0 && " or "}
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={() =>
                      void downloadApiFile(
                        `/assessments/import-sample?kind=${kind}`,
                        `assessment-${kind}-template.xlsx`
                      )
                    }
                  >
                    {kind === "mcq" ? "multiple choice" : "input based"}
                  </button>
                </span>
              ))}
              .
            </p>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleImport} disabled={saving}>
              {saving ? "Importing..." : "Import"}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
