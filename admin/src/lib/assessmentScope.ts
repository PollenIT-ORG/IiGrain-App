import { useParams } from "react-router-dom";
import { apiSlice } from "../store/api";
import { useAppDispatch } from "../store/hooks";
import { useGetProgramQuery } from "../store/endpoints/programsApi";
import { useGetTemplateQuery } from "../store/endpoints/assessmentApi";
import { useAuth } from "../store/useAuth";
import { useLiveData } from "./useLiveData";
import { useProgramCrumbs } from "./useProgramCrumbs";
import type { Crumb } from "../components/ui/Breadcrumbs";
import type { AssessmentTemplate, Program } from "../types";

// The template choice for a program that starts with no categories and no questions; the server takes the same word.
export const BLANK = "blank";
export const BLANK_LABEL = "Blank: no categories or questions";

const SUBMITTED_REASON =
  "This assessment has been submitted in a program, so it can no longer be changed. Copy it to make a new version.";

const LOCKED_REASON =
  "This assessment is locked. Unlock it first to change its categories or questions.";

export interface TemplateRights {
  editQuestions: boolean;
  questionsReason: string | null;
  editCategories: boolean;
  categoriesReason: string | null;
}

/** What the signed in person may change in a template, with the reason when they may not; the server checks the same. */
export function templateRights(
  template: AssessmentTemplate | undefined,
  user: { id: string; role: string } | null
): TemplateRights {
  const isPlatformAdmin = user?.role === "admin" || user?.role === "super_admin";
  if (!template || !user) {
    return { editQuestions: false, questionsReason: null, editCategories: false, categoriesReason: null };
  }

  let questionsReason: string | null = null;
  if (!isPlatformAdmin && template.is_global) {
    questionsReason = "Only an admin can change the Global template. Copy it to make your own.";
  } else if (!isPlatformAdmin && template.owner_id !== user.id && template.program_id === null) {
    questionsReason = "This template is shared with other programs. Copy it to make changes.";
  } else if (template.locked) {
    // A lock by hand can be undone; one earned by a submission cannot.
    questionsReason = template.has_submissions ? SUBMITTED_REASON : LOCKED_REASON;
  }

  // Categories follow the same rule as questions.
  return {
    editQuestions: questionsReason === null,
    questionsReason,
    editCategories: questionsReason === null,
    categoriesReason: questionsReason,
  };
}

export interface AssessmentScope {
  programId: string | undefined;
  program: Program | undefined;
  templateId: string | undefined;
  template: AssessmentTemplate | undefined;
  rights: TemplateRights;
  loading: boolean;
  failed: boolean;
  /** A page inside this template, e.g. "/categories/:id/questions". */
  to: (path: string) => string;
  /** Where going back ends up when no earlier page is known. */
  home: string;
}

/** The template a page works on: the program's own copy inside a program, otherwise the one in the address. */
export function useAssessmentScope(programIdProp?: string): AssessmentScope {
  const params = useParams<{ programId: string; templateId: string }>();
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const programId = programIdProp ?? params.programId;

  // Someone else changing the bank or swapping the program's template shows up here without a reload.
  useLiveData(["assessments", "programs"], () => {
    dispatch(
      apiSlice.util.invalidateTags(["AssessmentTemplates", "AssessmentTemplate", "AssessmentCategories", "AssessmentQuestions", "Program"])
    );
  });

  const programQuery = useGetProgramQuery(programId ?? "", { skip: !programId });
  const templateId = programId ? programQuery.data?.assessment_template_id : params.templateId;
  const templateQuery = useGetTemplateQuery(templateId ?? "", { skip: !templateId });

  // After a template swap the program briefly still points at its removed copy until the program itself reloads.
  const waitingForProgram = !!programId && templateQuery.isError && programQuery.isFetching;
  const base = programId ? `/programs/${programId}/assessments` : `/assessments/templates/${templateId ?? ""}`;
  return {
    programId,
    program: programQuery.data,
    templateId,
    template: templateQuery.data,
    rights: templateRights(templateQuery.data, user),
    loading:
      programQuery.isLoading ||
      templateQuery.isLoading ||
      waitingForProgram ||
      (!!programId && !templateId && !programQuery.isError),
    failed: programQuery.isError || (templateQuery.isError && !waitingForProgram),
    to: (path) => `${base}${path}`,
    home: programId ? `/programs/${programId}` : `/assessments/templates/${templateId ?? ""}`,
  };
}

/** The crumbs above a page inside a template: the program's own, or the template list and the template. */
export function useAssessmentCrumbs(scope: AssessmentScope): Crumb[] {
  const programCrumbs = useProgramCrumbs(scope.programId);
  if (scope.programId) return programCrumbs;
  return [
    { label: "Assessments", to: "/assessments" },
    { label: scope.template?.name ?? "Template", to: scope.home },
  ];
}

/** True for the template the question bank became when templates were introduced. */
export function isOriginalTemplate(template: AssessmentTemplate): boolean {
  return (
    !template.is_global &&
    template.owner_id === null &&
    template.program_id === null &&
    template.copied_from_id === null &&
    template.created_by === null
  );
}
