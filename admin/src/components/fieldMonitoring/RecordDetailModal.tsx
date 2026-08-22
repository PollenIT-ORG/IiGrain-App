import { useRef, useState, type DragEvent } from "react";
import Portal from "../ui/Portal";
import { showSuccess, showError } from "../../lib/toast";
import { useDialog } from "../ui/DialogProvider";
import { allFields, MODULE_BY_KEY, STATUS_LABEL } from "../../lib/fieldModules";
import {
  useListModuleDocumentsQuery,
  useUploadModuleDocumentMutation,
  useDeleteModuleDocumentMutation,
} from "../../store/endpoints/fieldMonitoringApi";
import type { ModuleKey, ModuleRecord, ModuleDocument } from "../../types";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx";

/** Whether the file can be shown rather than only linked. */
function isImage(doc: ModuleDocument): boolean {
  if (doc.mime_type?.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|heic|gif)$/i.test(doc.name);
}

function readableSize(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function shown(record: ModuleRecord, key: string, type: string): string {
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

/**
 * Everything held against one record: every field, including the ones the
 * table leaves out, and the files attached to that record.
 *
 * Photographs are shown rather than listed, because a picture of the field is
 * the point of taking it. Documents keep their name and size and open in a new
 * tab.
 */
export default function RecordDetailModal({
  module,
  programId,
  fieldId,
  record,
  canEdit,
  onEdit,
  onClose,
}: {
  module: ModuleKey;
  programId: string;
  fieldId: string;
  record: ModuleRecord;
  canEdit: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const def = MODULE_BY_KEY[module];
  const fields = allFields(module);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { confirm } = useDialog();

  // Only this record's files, asked for by id rather than filtered on screen.
  const { data: files = [], isLoading } = useListModuleDocumentsQuery({
    programId,
    fieldId,
    module,
    recordId: record.id,
  });

  const [upload, { isLoading: uploading }] = useUploadModuleDocumentMutation();
  const [remove] = useDeleteModuleDocumentMutation();

  const photos = files.filter(isImage);
  const docs = files.filter((f) => !isImage(f));

  async function send(list: FileList | null) {
    if (!list?.length) return;
    for (const file of Array.from(list)) {
      if (file.size > MAX_BYTES) {
        showError(`${file.name} is larger than 10 MB.`);
        continue;
      }
      try {
        await upload({
          programId,
          fieldId,
          module,
          recordId: record.id,
          kind: file.type.startsWith("image/") ? "photo" : "document",
          file,
        }).unwrap();
        showSuccess(`${file.name} attached.`);
      } catch (err) {
        showError(errMsg(err));
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onRemove(doc: ModuleDocument) {
    const yes = await confirm({
      title: "Remove this file?",
      message: `"${doc.name}" will be removed from this record.`,
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!yes) return;
    try {
      await remove({ programId, fieldId, documentId: doc.id, module }).unwrap();
      showSuccess("File removed.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  return (
    <Portal>
      <div className="modal-overlay" onMouseDown={onClose}>
        <div
          className="modal-panel card max-h-[90vh] w-full max-w-3xl overflow-y-auto p-6 sm:p-7"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900">{def.singular}</h2>
              <span
                className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                  record.status === "completed"
                    ? "bg-primary/10 text-primary"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {STATUS_LABEL[record.status] ?? record.status}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {canEdit && (
                <button onClick={onEdit} className="btn-secondary py-2 text-sm">
                  Edit
                </button>
              )}
              <button
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Every field, including the ones the table has no room for. */}
          <div className="mt-5 rounded-lg border border-gray-300">
            {fields.map((f, i) => (
              <div
                key={f.key}
                className={`grid gap-1 px-4 py-2.5 sm:grid-cols-[14rem_1fr] sm:gap-4 ${
                  i < fields.length - 1 ? "border-b border-gray-200" : ""
                }`}
              >
                <span className="text-xs text-gray-500 sm:text-sm">{f.label}</span>
                <span className="text-sm font-medium text-gray-900">
                  {shown(record, f.key, f.type)}
                </span>
              </div>
            ))}
          </div>

          {record.notes && (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">
                {record.notes}
              </p>
            </div>
          )}

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-900">
              Attachments{files.length > 0 && ` (${files.length})`}
            </h3>

            {isLoading ? (
              <p className="mt-2 text-sm text-gray-500">Loading files...</p>
            ) : (
              <>
                {photos.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {photos.map((doc) => (
                      <div key={doc.id} className="group relative">
                        <a href={doc.url} target="_blank" rel="noreferrer">
                          <img
                            src={doc.url}
                            alt={doc.name}
                            loading="lazy"
                            className="h-28 w-full rounded-lg border border-gray-300 object-cover"
                          />
                        </a>
                        <p className="mt-1 truncate text-xs text-gray-500" title={doc.name}>
                          {doc.name}
                        </p>
                        {canEdit && (
                          <button
                            onClick={() => void onRemove(doc)}
                            className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-gray-600 opacity-0 shadow transition-opacity hover:text-danger group-hover:opacity-100"
                            title="Remove"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {docs.length > 0 && (
                  <div className="mt-3 rounded-lg border border-gray-300">
                    {docs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-3 border-b border-gray-200 p-3 last:border-b-0"
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-gray-100 text-gray-500">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <path d="M14 2v6h6" />
                          </svg>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900">{doc.name}</p>
                          <p className="text-xs text-gray-500">
                            {readableSize(doc.size_bytes)}
                            {doc.size_bytes !== null && " · "}
                            {new Date(doc.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-primary"
                          title="Open or download"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <path d="M7 10l5 5 5-5M12 15V3" />
                          </svg>
                        </a>
                        {canEdit && (
                          <button
                            onClick={() => void onRemove(doc)}
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-danger"
                            title="Remove"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {files.length === 0 && (
                  <p className="mt-2 text-sm text-gray-500">
                    Nothing attached to this record yet.
                  </p>
                )}
              </>
            )}

            {canEdit && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e: DragEvent<HTMLDivElement>) => {
                  e.preventDefault();
                  setDragging(false);
                  void send(e.dataTransfer.files);
                }}
                className={`mt-3 rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                  dragging ? "border-primary bg-primary/5" : "border-gray-300"
                }`}
              >
                <p className="text-sm text-gray-700">
                  Drag files here or{" "}
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="font-semibold text-primary hover:underline"
                  >
                    browse
                  </button>
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Attached to this record. PDF, image or Word, up to 10 MB.
                </p>
                {uploading && (
                  <p className="mt-1 text-xs font-medium text-primary">Uploading...</p>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(e) => void send(e.target.files)}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
