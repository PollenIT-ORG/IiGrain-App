import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  useListCategoriesQuery,
  useDeleteCategoryMutation,
  useUpdateCategoryMutation,
  useReorderCategoriesMutation,
  useImportQuestionsMutation,
} from "../store/endpoints/assessmentApi";
import { showSuccess, showError } from "../lib/toast";
import { errMsg } from "../lib/errMsg";
import { useDialog } from "../components/ui/DialogProvider";
import Loader from "../components/Loader";
import {
  PlusIcon,
  EditIcon,
  TrashIcon,
  GripIcon,
  UploadIcon,
} from "../components/icons";
import type { AssessmentCategory } from "../types";

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
      <span className="h-1.5 w-1.5 rounded-full bg-success" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
      Inactive
    </span>
  );
}

interface SortableRowProps {
  category: AssessmentCategory;
  onEdit: (id: string) => void;
  onToggle: (cat: AssessmentCategory) => void;
  onDelete: (cat: AssessmentCategory) => void;
  onViewQuestions: (id: string) => void;
}

function SortableRow({ category, onEdit, onToggle, onDelete, onViewQuestions }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} className="hover:bg-gray-50">
      <td className="w-8 px-3 py-3 text-gray-400 cursor-grab active:cursor-grabbing">
        <button {...attributes} {...listeners} className="p-1 rounded hover:bg-gray-200">
          <GripIcon width={16} height={16} />
        </button>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 tabular-nums">{category.sort_order}</td>
      <td className="px-4 py-3">
        <p className="text-sm font-semibold text-gray-900">{category.name}</p>
        {category.description && (
          <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{category.description}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onViewQuestions(category.id)}
          className="text-sm font-medium text-primary hover:underline"
        >
          {category.question_count} question{category.question_count !== 1 ? "s" : ""}
        </button>
      </td>
      <td className="px-4 py-3">
        <ActiveBadge active={category.is_active} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onViewQuestions(category.id)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Questions
          </button>
          <button
            onClick={() => onToggle(category)}
            title={category.is_active ? "Deactivate" : "Activate"}
            className="grid h-8 w-8 place-items-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            {category.is_active ? (
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a4 4 0 0 0-8 0v2" />
              </svg>
            ) : (
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="11" width="20" height="10" rx="2" />
                <path d="M6 11V7a6 6 0 0 1 12 0v4" />
              </svg>
            )}
          </button>
          <button
            onClick={() => onEdit(category.id)}
            title="Edit"
            className="grid h-8 w-8 place-items-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            <EditIcon width={15} height={15} />
          </button>
          <button
            onClick={() => onDelete(category)}
            title="Delete"
            className="grid h-8 w-8 place-items-center rounded-lg border border-danger/30 text-danger hover:bg-danger/5"
          >
            <TrashIcon width={15} height={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function AssessmentCategories() {
  const navigate = useNavigate();
  const { confirm } = useDialog();

  const { data: categories = [], isLoading } = useListCategoriesQuery();
  const [deleteCategory] = useDeleteCategoryMutation();
  const [updateCategory] = useUpdateCategoryMutation();
  const [reorderCategories] = useReorderCategoriesMutation();
  const [importQuestions, { isLoading: importing }] =
    useImportQuestionsMutation();

  const [ordered, setOrdered] = useState<AssessmentCategory[]>([]);
  useEffect(() => { setOrdered(categories); }, [categories]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const fileRef = useRef<HTMLInputElement>(null);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const form = new FormData();
      form.append("file", file);
      const { created, skipped } = await importQuestions(form).unwrap();
      showSuccess(
        `Import complete - ${created} question(s) created, ${skipped} skipped.`
      );
    } catch (err) {
      showError(errMsg(err));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const prev = ordered;
    const oldIndex = ordered.findIndex((c) => c.id === active.id);
    const newIndex = ordered.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(ordered, oldIndex, newIndex);
    setOrdered(reordered);

    try {
      await reorderCategories(
        reordered.map((c, i) => ({ id: c.id, sortOrder: i }))
      ).unwrap();
    } catch (err) {
      showError(errMsg(err));
      setOrdered(prev);
    }
  }

  async function handleToggle(cat: AssessmentCategory) {
    try {
      await updateCategory({ id: cat.id, body: { isActive: !cat.is_active } }).unwrap();
      showSuccess(`Category ${cat.is_active ? "deactivated" : "activated"}.`);
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleDelete(cat: AssessmentCategory) {
    const ok = await confirm({
      title: "Delete category?",
      message: `"${cat.name}" and all its questions will be removed. This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteCategory(cat.id).unwrap();
      showSuccess("Category deleted.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assessment Categories</h1>
          <p className="mt-1 text-sm text-gray-500">
            Drag rows to reorder. Click "Questions" to manage questions in a category.
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImport}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <UploadIcon width={16} height={16} />
            {importing ? "Importing…" : "Import Excel"}
          </button>
          <button
            onClick={() => navigate("/assessments/categories/new")}
            className="btn-primary flex items-center gap-2"
          >
            <PlusIcon width={18} height={18} />
            New Category
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600">
        <span className="font-semibold text-gray-700">Excel import - </span>
        One spreadsheet creates everything: each row's{" "}
        <code className="rounded bg-gray-200 px-1 py-0.5">Section</code> becomes a
        category (auto-created if missing) and its{" "}
        <code className="rounded bg-gray-200 px-1 py-0.5">QuestionText</code> is
        added as a question inside it. Optional columns:{" "}
        <code className="rounded bg-gray-200 px-1 py-0.5">QuestionCode</code>,{" "}
        <code className="rounded bg-gray-200 px-1 py-0.5">GuidanceNote</code>,{" "}
        <code className="rounded bg-gray-200 px-1 py-0.5">Score0Description</code>{" "}
        - <code className="rounded bg-gray-200 px-1 py-0.5">Score3Description</code>.
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader size="md" />
          </div>
        ) : ordered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="text-gray-500">No categories yet.</p>
            <button
              onClick={() => navigate("/assessments/categories/new")}
              className="mt-3 text-sm font-medium text-primary hover:underline"
            >
              Create the first category
            </button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={ordered.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <table className="w-full text-left">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="w-8 px-3 py-3" />
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Questions</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ordered.map((cat) => (
                    <SortableRow
                      key={cat.id}
                      category={cat}
                      onEdit={(id) => navigate(`/assessments/categories/${id}/edit`)}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                      onViewQuestions={(id) =>
                        navigate(`/assessments/categories/${id}/questions`)
                      }
                    />
                  ))}
                </tbody>
              </table>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
