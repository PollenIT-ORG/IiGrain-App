import { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useListFaqsQuery,
  useCreateFaqMutation,
  useUpdateFaqMutation,
  useDeleteFaqMutation,
  useReorderFaqsMutation,
} from "../store/endpoints/helpApi";
import { showSuccess, showError } from "../lib/toast";
import { errMsg } from "../lib/errMsg";
import { useDialog } from "../components/ui/DialogProvider";
import Loader from "../components/Loader";
import Portal from "../components/ui/Portal";
import Select from "../components/ui/Select";
import { PlusIcon, EditIcon, TrashIcon, GripIcon, CloseIcon } from "../components/icons";
import type { Faq } from "../types";

// The same limits the server enforces, so a long answer is caught in the box
// rather than after a round trip.
const MAX_QUESTION = 300;
const MAX_ANSWER = 5000;
const PAGE_SIZE = 100;

interface Draft {
  question: string;
  answer: string;
  isActive: boolean;
}

const EMPTY: Draft = { question: "", answer: "", isActive: true };

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
      <span className="h-1.5 w-1.5 rounded-full bg-success" />
      Shown
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
      Hidden
    </span>
  );
}

interface RowProps {
  faq: Faq;
  onEdit: (faq: Faq) => void;
  onToggle: (faq: Faq) => void;
  onDelete: (faq: Faq) => void;
}

function SortableRow({ faq, onEdit, onToggle, onDelete }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: faq.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} className="hover:bg-gray-50">
      <td className="cursor-grab px-3 py-3 text-gray-400 active:cursor-grabbing">
        <button
          {...attributes}
          {...listeners}
          aria-label="Reorder"
          className="rounded p-1 hover:bg-gray-200"
        >
          <GripIcon width={16} height={16} />
        </button>
      </td>
      {/* The full wording is one click away in the editor, so both lines are
          cut here rather than widening the table past the screen. */}
      <td className="px-4 py-3">
        <p className="truncate text-sm font-semibold text-gray-900">{faq.question}</p>
        <p className="mt-0.5 truncate text-xs text-gray-500">{faq.answer}</p>
      </td>
      <td className="hidden px-4 py-3 sm:table-cell">
        <ActiveBadge active={faq.is_active} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onToggle(faq)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            {faq.is_active ? "Hide" : "Show"}
          </button>
          <button
            onClick={() => onEdit(faq)}
            aria-label="Edit"
            className="grid h-8 w-8 place-items-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            <EditIcon width={15} height={15} />
          </button>
          <button
            onClick={() => onDelete(faq)}
            aria-label="Delete"
            className="grid h-8 w-8 place-items-center rounded-lg border border-gray-300 text-danger hover:bg-danger/5"
          >
            <TrashIcon width={15} height={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function Faqs() {
  const { confirm } = useDialog();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useListFaqsQuery({
    page: 1,
    limit: PAGE_SIZE,
    ...(status ? { status: status as "active" | "inactive" } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  });

  const [createFaq, { isLoading: creating }] = useCreateFaqMutation();
  const [updateFaq, { isLoading: saving }] = useUpdateFaqMutation();
  const [deleteFaq] = useDeleteFaqMutation();
  const [reorderFaqs] = useReorderFaqsMutation();

  const faqs = data?.faqs ?? [];
  const [ordered, setOrdered] = useState<Faq[]>([]);
  useEffect(() => {
    setOrdered(faqs);
  }, [faqs]);

  const [editing, setEditing] = useState<Faq | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Dragging is only meaningful on the full list, so it is off while filtered.
  const canDrag = !status && !search.trim();

  function startNew() {
    setEditing(null);
    setDraft(EMPTY);
    setErrors({});
    setOpen(true);
  }

  function startEdit(faq: Faq) {
    setEditing(faq);
    setDraft({ question: faq.question, answer: faq.answer, isActive: faq.is_active });
    setErrors({});
    setOpen(true);
  }

  /** The same rules the server applies, checked before anything is sent. */
  function validate(d: Draft): Partial<Record<keyof Draft, string>> {
    const next: Partial<Record<keyof Draft, string>> = {};
    const q = d.question.trim();
    const a = d.answer.trim();
    if (q.length < 5) next.question = "The question must be at least 5 characters.";
    else if (q.length > MAX_QUESTION) next.question = `At most ${MAX_QUESTION} characters.`;
    if (a.length < 5) next.answer = "The answer must be at least 5 characters.";
    else if (a.length > MAX_ANSWER) next.answer = `At most ${MAX_ANSWER} characters.`;
    return next;
  }

  async function save() {
    const found = validate(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const body = {
      question: draft.question.trim(),
      answer: draft.answer.trim(),
      isActive: draft.isActive,
    };
    try {
      if (editing) {
        await updateFaq({ id: editing.id, body }).unwrap();
        showSuccess("FAQ updated.");
      } else {
        await createFaq(body).unwrap();
        showSuccess("FAQ added.");
      }
      setOpen(false);
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleToggle(faq: Faq) {
    try {
      await updateFaq({ id: faq.id, body: { isActive: !faq.is_active } }).unwrap();
      showSuccess(faq.is_active ? "Hidden from the app." : "Shown in the app.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleDelete(faq: Faq) {
    const ok = await confirm({
      title: "Delete this FAQ?",
      message: `"${faq.question}" will stop showing in the app. This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteFaq(faq.id).unwrap();
      showSuccess("FAQ deleted.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const prev = ordered;
    const oldIndex = ordered.findIndex((f) => f.id === active.id);
    const newIndex = ordered.findIndex((f) => f.id === over.id);
    const next = arrayMove(ordered, oldIndex, newIndex);
    setOrdered(next);

    try {
      await reorderFaqs(next.map((f, i) => ({ id: f.id, sortOrder: i }))).unwrap();
      showSuccess("Order saved.");
    } catch (err) {
      showError(errMsg(err));
      setOrdered(prev);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Help &amp; FAQs</h1>
          <p className="mt-1 text-sm text-gray-500">
            What the app shows on its Help screen. Drag rows to set the order farmers
            see. Hidden entries stay here but never reach the app.
          </p>
        </div>
        <button onClick={startNew} className="btn-primary flex items-center gap-2 sm:flex-shrink-0">
          <PlusIcon width={18} height={18} />
          New FAQ
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search questions and answers..."
          maxLength={200}
          className="input-field text-sm sm:max-w-xs"
        />
        <Select
          value={status}
          onChange={setStatus}
          options={[
            { value: "", label: "All" },
            { value: "active", label: "Shown in the app" },
            { value: "inactive", label: "Hidden" },
          ]}
          className="w-48"
        />
        {!canDrag && (
          <span className="text-xs text-gray-500">
            Clear the search and filter to reorder.
          </span>
        )}
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <Loader message="Loading FAQs..." />
        ) : isError ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            Couldn't load the FAQs.
          </div>
        ) : ordered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-sm text-gray-500">
              {search || status ? "Nothing matches that." : "No FAQs yet."}
            </p>
            {!search && !status && (
              <button onClick={startNew} className="btn-primary mt-4">
                Add the first one
              </button>
            )}
          </div>
        ) : (
          <div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              {/* Fixed layout so a long answer cuts off instead of pushing the
                  buttons off the right edge. */}
              <table className="w-full table-fixed text-left text-sm">
                <thead className="border-b border-gray-300 bg-gray-50">
                  <tr>
                    <th className="w-10 px-3 py-3" />
                    <th className="px-4 py-3 font-semibold text-gray-600">Question</th>
                    <th className="hidden w-28 px-4 py-3 font-semibold text-gray-600 sm:table-cell">
                      In the app
                    </th>
                    <th className="w-44 px-4 py-3 text-right font-semibold text-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <SortableContext
                    items={ordered.map((f) => f.id)}
                    strategy={verticalListSortingStrategy}
                    disabled={!canDrag}
                  >
                    {ordered.map((faq) => (
                      <SortableRow
                        key={faq.id}
                        faq={faq}
                        onEdit={startEdit}
                        onToggle={handleToggle}
                        onDelete={handleDelete}
                      />
                    ))}
                  </SortableContext>
                </tbody>
              </table>
            </DndContext>
          </div>
        )}
      </div>

      {/* Rendered at the end of body, so the backdrop covers the sidebar too. */}
      {open && (
        <Portal>
        <div className="modal-overlay" onMouseDown={() => setOpen(false)}>
          <div
            className="modal-panel card max-h-[90vh] w-full max-w-2xl overflow-y-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? "Edit FAQ" : "New FAQ"}
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100"
              >
                <CloseIcon width={18} height={18} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div>
                <label htmlFor="faq-question" className="mb-1 block text-sm font-medium text-gray-700">
                  Question
                </label>
                <input
                  id="faq-question"
                  type="text"
                  value={draft.question}
                  onChange={(e) => setDraft({ ...draft, question: e.target.value })}
                  maxLength={MAX_QUESTION}
                  placeholder="How do I add a field?"
                  className="input-field"
                />
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-danger">{errors.question ?? ""}</span>
                  <span className="text-xs text-gray-400">
                    {draft.question.length}/{MAX_QUESTION}
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor="faq-answer" className="mb-1 block text-sm font-medium text-gray-700">
                  Answer
                </label>
                <textarea
                  id="faq-answer"
                  value={draft.answer}
                  onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
                  maxLength={MAX_ANSWER}
                  rows={7}
                  placeholder="Open the farm, then tap Add Field at the bottom of the screen."
                  className="input-field"
                />
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-danger">{errors.answer ?? ""}</span>
                  <span className="text-xs text-gray-400">
                    {draft.answer.length}/{MAX_ANSWER}
                  </span>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-primary"
                />
                Show this in the app
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-300 px-5 py-4">
              <button onClick={() => setOpen(false)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={save} disabled={creating || saving} className="btn-primary">
                {creating || saving ? "Saving..." : editing ? "Save changes" : "Add FAQ"}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
