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
import { useAssessmentCrumbs, useAssessmentScope } from "../lib/assessmentScope";
import { useReturnTo } from "../lib/returnTo";
import { ReasonNote } from "../components/AssessmentTemplateUi";
import Loader from "../components/Loader";
import Breadcrumbs from "../components/ui/Breadcrumbs";

const NAME_MAX = 150;
const DESCRIPTION_MAX = 500;

export default function CategoryForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const scope = useAssessmentScope();
  const { templateId, template, rights, to, home } = scope;
  const back = useReturnTo(home);
  const crumbs = useAssessmentCrumbs(scope);

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
    if (!templateId) return;
    const next = {
      name: required(name, "Category name") ??
        (name.trim().length > NAME_MAX ? `Category name must be ${NAME_MAX} characters or fewer.` : null),
      description: description.trim().length > DESCRIPTION_MAX
        ? `Description must be ${DESCRIPTION_MAX} characters or fewer.`
        : null,
    };
    setErrors(next);
    if (!isClean(next)) return;
    const body = {
      name: name.trim(),
      description: description.trim() || null,
      isActive,
    };
    try {
      if (isEdit) {
        await updateCategory({ id: id!, body }).unwrap();
        showSuccess("Category updated.");
      } else {
        const created = await createCategory({ templateId, body }).unwrap();
        showSuccess("Category created.");
        // A category of an input based assessment is a form, so its fields come next.
        // The form carries on where this page came from, not this page itself.
        if (scope.template?.question_kind === "input") {
          navigate(to(`/categories/${created.id}/questions`), {
            replace: true,
            state: { from: back.path, fromState: back.state },
          });
          return;
        }
      }
      back.go();
    } catch (err) {
      showError(errMsg(err));
    }
  }

  if (scope.loading || (isEdit && loadingExisting)) {
    return (
      <div className="flex justify-center py-20">
        <Loader size="md" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Breadcrumbs
        items={[
          ...crumbs,
          ...(isEdit
            ? [
                { label: existing?.name ?? "Category", to: to(`/categories/${id}/questions`) },
                { label: "Edit" },
              ]
            : [{ label: "New category" }]),
        ]}
      />

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">
          {isEdit ? "Edit Category" : "New Category"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {template ? `${template.name}. ` : ""}Categories group related assessment questions together.
        </p>

        {scope.failed || !template ? (
          <p className="mt-6 text-sm text-gray-500">
            This assessment could not be loaded. It may have been removed, or you may not have access to it.
          </p>
        ) : !rights.editCategories ? (
          <div className="mt-6">
            <ReasonNote>{rights.categoriesReason}</ReasonNote>
          </div>
        ) : (
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
                maxLength={NAME_MAX}
              />
              {errors.name && <p className="field-error">{errors.name}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                className={`input-field min-h-[80px] resize-y ${errors.description ? "input-error" : ""}`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description for this category"
                maxLength={DESCRIPTION_MAX}
                rows={3}
              />
              {errors.description && <p className="field-error">{errors.description}</p>}
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
                onClick={() => back.go()}
                className="btn-outline"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={isSaving}>
                {isSaving ? "Saving..." : isEdit ? "Save changes" : "Create category"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
