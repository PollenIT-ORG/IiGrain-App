import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useGetCategoryQuery,
} from "../store/endpoints/assessmentApi";
import { showSuccess, showError } from "../lib/toast";
import { errMsg } from "../lib/errMsg";
import { required, isClean } from "../lib/validation";
import Loader from "../components/Loader";

export default function CategoryForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const { data: existing, isLoading: loadingExisting } = useGetCategoryQuery(
    id!,
    { skip: !isEdit }
  );

  const [createCategory, { isLoading: creating }] = useCreateCategoryMutation();
  const [updateCategory, { isLoading: updating }] = useUpdateCategoryMutation();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setDescription(existing.description ?? "");
      setIsActive(existing.is_active);
    }
  }, [existing]);

  const isSaving = creating || updating;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = { name: required(name, "Category name") };
    setErrors(next);
    if (!isClean(next)) return;
    try {
      if (isEdit) {
        await updateCategory({
          id: id!,
          body: {
            name: name.trim(),
            description: description.trim() || null,
            isActive,
          },
        }).unwrap();
        showSuccess("Category updated.");
      } else {
        await createCategory({
          name: name.trim(),
          description: description.trim() || null,
          isActive,
        }).unwrap();
        showSuccess("Category created.");
      }
      navigate("/assessments");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  if (isEdit && loadingExisting) {
    return (
      <div className="flex justify-center py-20">
        <Loader size="md" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <button
        onClick={() => navigate("/assessments")}
        className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to categories
      </button>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">
          {isEdit ? "Edit Category" : "New Category"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Categories group related assessment questions together.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Category name <span className="text-danger">*</span>
            </label>
            <input
              className={`input-field ${errors.name ? "input-error" : ""}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Biodiversity & Habitat"
              maxLength={150}
            />
            {errors.name && <p className="field-error">{errors.name}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              className="input-field min-h-[80px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description for this category"
              maxLength={500}
              rows={3}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isActive ? "bg-primary" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  isActive ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className="text-sm font-medium text-gray-700">
              {isActive ? "Active" : "Inactive"}
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate("/assessments")}
              className="btn-outline"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSaving}>
              {isSaving ? "Saving…" : isEdit ? "Save changes" : "Create category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
