import { useRef, useState, type DragEvent } from "react";
import { showSuccess, showError } from "../../lib/toast";
import { useDialog } from "../ui/DialogProvider";
import {
  useUploadModuleDocumentMutation,
  useDeleteModuleDocumentMutation,
} from "../../store/endpoints/fieldMonitoringApi";
import type { DocumentModule, ModuleDocument } from "../../types";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx";

function readableSize(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The upload box at the foot of a module, and the files sitting under it.
 *
 * These are the files that belong to the module as a whole rather than to one
 * row; a file attached to a row is shown on the row itself.
 */
export default function ModuleDocuments({
  programId,
  fieldId,
  module,
  documents,
  canEdit,
}: {
  programId: string;
  fieldId: string;
  module: DocumentModule;
  /** Already filtered to this module by the page. */
  documents: ModuleDocument[];
  canEdit: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [upload, { isLoading: uploading }] = useUploadModuleDocumentMutation();
  const [remove] = useDeleteModuleDocumentMutation();
  const { confirm } = useDialog();

  const loose = documents.filter((d) => d.record_id === null);

  async function send(files: FileList | null) {
    if (!files?.length) return;

    for (const file of Array.from(files)) {
      // Checked here as well as on the server, so an oversized file is refused
      // before it is carried all the way up.
      if (file.size > MAX_BYTES) {
        showError(`${file.name} is larger than 10 MB.`);
        continue;
      }
      try {
        await upload({ programId, fieldId, module, file }).unwrap();
        showSuccess(`${file.name} uploaded.`);
      } catch (err) {
        showError(errMsg(err));
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (canEdit) void send(e.dataTransfer.files);
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
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-gray-900">Upload New Document</h3>

      {canEdit && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`mt-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
            dragging ? "border-primary bg-primary/5" : "border-gray-300"
          }`}
        >
          <svg
            className="mx-auto text-primary"
            width="30" height="30" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 16V4m0 0L8 8m4-4 4 4" />
            <path d="M20 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
          </svg>
          <p className="mt-2 text-sm text-gray-700">
            Drag and drop files here or{" "}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="font-semibold text-primary hover:underline"
            >
              browse
            </button>
          </p>
          <p className="mt-1 text-xs text-gray-500">
            PDF, image or Word document. Maximum 10 MB.
          </p>
          {uploading && (
            <p className="mt-2 text-xs font-medium text-primary">Uploading...</p>
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

      {loose.length > 0 && (
        <div className="mt-3 rounded-lg border border-gray-300">
          {loose.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 border-b border-gray-200 p-3 last:border-b-0"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-gray-100 text-gray-500">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{doc.name}</p>
                <p className="text-xs text-gray-500">
                  {readableSize(doc.size_bytes)}
                  {doc.size_bytes !== null && " · "}
                  Uploaded {new Date(doc.created_at).toLocaleDateString()}
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

      <p className="mt-2 text-xs text-gray-500">
        All uploads are stored securely and linked to this field and program year.
      </p>
    </div>
  );
}
