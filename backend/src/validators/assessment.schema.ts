import { z } from "zod";
import { pageField, limitField } from "./pagination.schema.js";

export const idParamSchema = z.object({
  id: z.string().uuid("Invalid id."),
});

export const templateCategoryParamsSchema = z.object({
  id: z.string().uuid("Invalid template id."),
  categoryId: z.string().uuid("Invalid category id."),
});

export const fieldIdParamSchema = z.object({
  fieldId: z.string().uuid("Invalid field id."),
});

export const historyQuerySchema = z.object({
  farmId: z.string().uuid("Invalid farm id.").optional(),
  page: pageField(1),
  limit: limitField(20, 100),
  search: z.string().trim().max(100).optional(),
});

export type HistoryQuery = z.infer<typeof historyQuerySchema>;

export const fieldCategoryParamsSchema = z.object({
  fieldId: z.string().uuid("Invalid field id."),
  categoryId: z.string().uuid("Invalid category id."),
});

export const fieldQuestionParamsSchema = z.object({
  fieldId: z.string().uuid("Invalid field id."),
  questionId: z.string().uuid("Invalid question id."),
});

export const fieldCategoryQuestionParamsSchema = z.object({
  fieldId: z.string().uuid("Invalid field id."),
  categoryId: z.string().uuid("Invalid category id."),
  questionId: z.string().uuid("Invalid question id."),
});

// Program-scoped variants: assessments are per (field + program).
export const programFieldParamsSchema = z.object({
  programId: z.string().uuid("Invalid program id."),
  fieldId: z.string().uuid("Invalid field id."),
});

export const programFieldCategoryParamsSchema = z.object({
  programId: z.string().uuid("Invalid program id."),
  fieldId: z.string().uuid("Invalid field id."),
  categoryId: z.string().uuid("Invalid category id."),
});

// One record of a form, for a field in a program.
export const programFieldRecordParamsSchema = programFieldCategoryParamsSchema.extend({
  recordId: z.string().uuid("Invalid record id."),
});

export const programFieldQuestionParamsSchema = z.object({
  programId: z.string().uuid("Invalid program id."),
  fieldId: z.string().uuid("Invalid field id."),
  questionId: z.string().uuid("Invalid question id."),
});

export const programFieldCategoryQuestionParamsSchema = z.object({
  programId: z.string().uuid("Invalid program id."),
  fieldId: z.string().uuid("Invalid field id."),
  categoryId: z.string().uuid("Invalid category id."),
  questionId: z.string().uuid("Invalid question id."),
});

const cloudinaryUrl = z
  .string()
  .trim()
  .url("Each evidence item must be a valid URL.")
  .refine(
    (u) => /^https:\/\/res\.cloudinary\.com\//i.test(u),
    "Evidence must be a Cloudinary image URL."
  );

// A cleared field arrives as null, which must not be read as the number zero.
const blankToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === null || v === "" ? undefined : v), schema.optional());

// The answer itself. Which of these the question needs is decided by its type,
// so the service checks that; here each one is only held to its own limits.
export const saveAnswerSchema = z.object({
  // The 0 to 3 questions the app has always sent.
  score: blankToUndefined(
    z.coerce
      .number({ error: "A score is required." })
      .int("Score must be a whole number.")
      .min(0, "Score must be between 0 and 3.")
      .max(3, "Score must be between 0 and 3.")
  ),
  // The chosen answer of a multiple choice question.
  optionId: z.string().uuid("Choose one of the given answers.").optional(),
  answerText: z
    .string()
    .trim()
    .max(5000, "This answer is too long.")
    .optional(),
  answerNumber: blankToUndefined(
    z.coerce
      .number({ error: "Enter a number." })
      .refine((n) => Number.isFinite(n), "Enter a number.")
      .min(-1_000_000_000, "This number is too small.")
      .max(1_000_000_000, "This number is too large.")
  ),
  answerDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD.")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Enter a real date.")
    .optional(),
  answerBoolean: z.boolean({ error: "Choose Yes or No." }).optional(),
  // null (or "") clears the comment; undefined leaves whatever was saved.
  comment: z
    .string()
    .trim()
    .max(2000, "Comment is too long.")
    .nullable()
    .optional(),
  // null (or []) clears the photos; undefined leaves them.
  evidenceUrls: z
    .array(cloudinaryUrl)
    .max(5, "You can attach at most 5 photos.")
    .nullable()
    .optional(),
});

// "scored" is the 0 to 3 question older templates hold. A new question is
// either multiple choice, which scores itself, or one of the input types a
// form asks for, which an admin scores during review.
export const QUESTION_TYPES = [
  "scored",
  "mcq",
  "text",
  "long_text",
  "number",
  "date",
  "boolean",
] as const;

// The input types, in the order the panel offers them.
export const INPUT_TYPES = ["text", "long_text", "number", "date", "boolean"] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const ANSWER_EXTRAS = ["off", "optional", "required"] as const;

export type AnswerExtra = (typeof ANSWER_EXTRAS)[number];

// What a template holds: only multiple choice questions, or only inputs.
export const QUESTION_KINDS = ["mcq", "input"] as const;

export type QuestionKind = (typeof QUESTION_KINDS)[number];

const questionType = z.enum(QUESTION_TYPES, { error: "Choose a question type." }).optional();

// A whole category filled in at once: one form, one save.
export const saveCategoryAnswersSchema = z
  .object({
    answers: z
      .array(
        saveAnswerSchema.extend({
          questionId: z.string().uuid("Invalid question id."),
        })
      )
      .max(200, "Too many answers in one form."),
    // The evidence uploaded at the end of the form. null (or []) clears it; left out keeps it.
    evidenceUrls: z
      .array(cloudinaryUrl)
      .max(5, "You can attach at most 5 files.")
      .nullable()
      .optional(),
  })
  .refine((body) => body.answers.length > 0 || body.evidenceUrls !== undefined, {
    message: "Nothing to save.",
    path: ["answers"],
  });

// ---------------------------- Assessment templates ----------------------------

const templateName = z
  .string({ error: "Template name is required." })
  .trim()
  .min(1, "Template name is required.")
  .max(150, "Template name must be 150 characters or fewer.");

const templateDescription = z
  .string()
  .trim()
  .max(500, "Description must be 500 characters or fewer.")
  .nullable()
  .optional();

// The Assessments list: a page of it, searched and narrowed to one kind.
export const listTemplatesQuerySchema = z.object({
  // Left out, the whole list comes back for the pickers; given, one page of it.
  page: z.coerce
    .number({ error: "Page must be a number." })
    .int("Page must be a whole number.")
    .min(1, "Page must be 1 or higher.")
    .max(100000, "That page number is too high.")
    .optional(),
  limit: limitField(20, 100),
  search: z.string().trim().max(100, "Search is too long.").optional(),
  kind: z.enum(["mcq", "input"], { error: "Choose multiple choice or input based." }).optional(),
});
export type ListTemplatesQuery = z.infer<typeof listTemplatesQuerySchema>;

export const createTemplateSchema = z.object({
  name: templateName,
  description: templateDescription,
  // Only for a blank template: which kind of questions it takes.
  questionKind: z.enum(QUESTION_KINDS, { error: "Choose multiple choice or input based." }).optional(),
  // "global" copies the Global template, "blank" starts empty, an id copies that template.
  basedOn: z
    .string({ error: "Choose what the template starts from." })
    .trim()
    .refine(
      (v) => v === "global" || v === "blank" || z.uuid().safeParse(v).success,
      { message: "Choose Global, Blank or a template you can see." }
    )
    .default("global"),
});

export const updateTemplateSchema = z
  .object({
    name: templateName.optional(),
    description: templateDescription,
    isActive: z.boolean({ error: "isActive must be true or false." }).optional(),
  })
  .refine(
    (v) => v.name !== undefined || v.description !== undefined || v.isActive !== undefined,
    { error: "Provide at least one field to update." }
  );

// ------------------------- Categories and questions -------------------------

const categoryName = z
  .string({ error: "Category name is required." })
  .trim()
  .min(1, "Category name is required.")
  .max(150, "Category name must be 150 characters or fewer.");

const categoryDescription = z
  .string()
  .trim()
  .max(500, "Description must be 500 characters or fewer.")
  .optional()
  .nullable();

const sortOrder = z.coerce
  .number({ error: "Sort order must be a number." })
  .int("Sort order must be a whole number.")
  .min(0, "Sort order cannot be negative.")
  .max(100000, "Sort order is too large.")
  .optional();

export const createCategorySchema = z.object({
  name: categoryName,
  description: categoryDescription,
  sortOrder,
  isActive: z.boolean().optional(),
});

export const updateCategorySchema = z
  .object({
    name: categoryName.optional(),
    description: categoryDescription,
    sortOrder,
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    error: "Provide at least one field to update.",
  });

export const reorderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid("Invalid id."),
        sortOrder: z.coerce.number().int().min(0).max(100000),
      })
    )
    .min(1, "Nothing to reorder.")
    .max(1000, "Too many items to reorder at once."),
});

// The guidance and score notes are prose, so they get a ceiling rather than
// being left open - the boxes in the panel stop at the same length.
const describes = (max: number) =>
  z.string().max(max, `This text is too long (limit ${max}).`).optional().nullable();

const questionText = z
  .string({ error: "Question text is required." })
  .trim()
  .min(1, "Question text is required.")
  .max(500, "Question text is too long.");

const questionCode = z
  .string()
  .trim()
  .max(20, "Question code must be 20 characters or fewer.")
  .optional()
  .nullable();

const evidenceMode = z
  .enum(ANSWER_EXTRAS, { error: "Choose off, optional or required for the photo." })
  .optional();

const commentMode = z
  .enum(ANSWER_EXTRAS, { error: "Choose off, optional or required for the description." })
  .optional();

const maxScore = z.coerce
  .number({ error: "The highest score must be a number." })
  .int("The highest score must be a whole number.")
  .min(1, "The highest score must be at least 1.")
  .max(100, "The highest score cannot be more than 100.")
  .optional();

// The answers of a multiple choice question, each with the score it gives.
const optionsField = z
  .array(
    z.object({
      optionText: z
        .string({ error: "Answer text is required." })
        .trim()
        .min(1, "Answer text is required.")
        .max(300, "Answer text must be 300 characters or fewer."),
      score: z.coerce
        .number({ error: "Each answer needs a score." })
        .int("A score must be a whole number.")
        .min(0, "A score cannot be negative.")
        .max(100, "A score cannot be more than 100."),
    })
  )
  .min(2, "A multiple choice question needs at least two answers.")
  .max(20, "A multiple choice question can have at most 20 answers.")
  .optional();

export const createQuestionSchema = z.object({
  categoryId: z.string({ error: "Choose a category." }).uuid("Choose a category."),
  questionCode,
  questionText,
  questionType,
  maxScore,
  options: optionsField,
  evidenceMode,
  commentMode,
  guidanceNote: describes(1000),
  score0Description: describes(500),
  score1Description: describes(500),
  score2Description: describes(500),
  score3Description: describes(500),
  sortOrder,
  isActive: z.boolean().optional(),
});

export const updateQuestionSchema = z
  .object({
    categoryId: z.string().uuid("Choose a category.").optional(),
    questionCode,
    questionText: questionText.optional(),
    questionType,
    maxScore,
    options: optionsField,
    evidenceMode,
    commentMode,
    guidanceNote: describes(1000),
    score0Description: describes(500),
    score1Description: describes(500),
    score2Description: describes(500),
    score3Description: describes(500),
    sortOrder,
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    error: "Provide at least one field to update.",
  });

// A whole form: every field of one category, in the order they are shown.
export const saveCategoryFieldsSchema = z.object({
  fields: z
    .array(
      z.object({
        // Left out for a field being added now.
        id: z.string().uuid("Invalid field id.").optional(),
        questionCode,
        questionText,
        questionType,
        maxScore,
        options: optionsField,
        evidenceMode,
        commentMode,
        isActive: z.boolean().optional(),
      })
    )
    .max(200, "A form can hold at most 200 fields."),
});

export const listQuestionsQuerySchema = z.object({
  page: pageField(1),
  limit: limitField(50, 200),
  categoryId: z.string().uuid("Invalid category id.").optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => {
      if (v === "true") return true;
      if (v === "false") return false;
      return undefined;
    }),
  search: z.string().trim().max(100).optional(),
});

// One spreadsheet row, held to the same limits as the question form.
export const importRowSchema = z.object({
  section: z
    .string()
    .trim()
    .min(1, "Section is required.")
    .max(150, "Section must be 150 characters or fewer."),
  questionCode,
  questionText,
  questionType: z.enum(QUESTION_TYPES, { error: "That answer type is not one we know." }),
  maxScore,
  evidenceMode,
  commentMode,
  options: z
    .array(
      z.object({
        optionText: z.string().trim().min(1).max(300, "An answer must be 300 characters or fewer."),
        score: z.coerce.number().int().min(0).max(100),
      })
    )
    .optional(),
  guidanceNote: describes(1000),
  score0Description: describes(500),
  score1Description: describes(500),
  score2Description: describes(500),
  score3Description: describes(500),
});

// ------------------------------ Admin review -------------------------------

export const reviewScoresSchema = z.object({
  scores: z
    .array(
      z.object({
        questionId: z.string().uuid("Invalid question id."),
        // Which filling of a form the score is for; left out for a single answer.
        recordId: z.string().uuid("Invalid record id.").nullable().optional(),
        score: z.coerce
          .number({ error: "Enter a score." })
          .int("A score must be a whole number.")
          .min(0, "A score cannot be negative.")
          .max(100, "A score cannot be more than 100."),
      })
    )
    .max(2000, "Too many scores in one go.")
    .optional(),
  // One score per category, instead of scoring every answer.
  categoryScores: z
    .array(
      z.object({
        categoryId: z.string().uuid("Invalid category id."),
        score: z.coerce
          .number({ error: "Enter a score." })
          .int("A score must be a whole number.")
          .min(0, "A score cannot be negative.")
          .max(100000, "That score is too high."),
      })
    )
    .max(200, "Too many categories in one go.")
    .optional(),
  // One score for the whole assessment, instead of scoring every answer.
  overallScore: blankToUndefined(
    z.coerce
      .number({ error: "Enter a score." })
      .int("A score must be a whole number.")
      .min(0, "A score cannot be negative.")
      .max(100000, "That score is too high.")
  ).optional(),
  note: z
    .string()
    .trim()
    .max(2000, "The note is too long.")
    .nullable()
    .optional(),
});

export type CreateTemplateBody = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateBody = z.infer<typeof updateTemplateSchema>;
export type CreateCategoryBody = z.infer<typeof createCategorySchema>;
export type UpdateCategoryBody = z.infer<typeof updateCategorySchema>;
export type CreateQuestionBody = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionBody = z.infer<typeof updateQuestionSchema>;
export type ReorderBody = z.infer<typeof reorderSchema>;
export type ListQuestionsQuery = z.infer<typeof listQuestionsQuerySchema>;
export type SaveCategoryFieldsBody = z.infer<typeof saveCategoryFieldsSchema>;
export type SaveAnswerBody = z.infer<typeof saveAnswerSchema>;
export type SaveCategoryAnswersBody = z.infer<typeof saveCategoryAnswersSchema>;
export type ReviewScoresBody = z.infer<typeof reviewScoresSchema>;
