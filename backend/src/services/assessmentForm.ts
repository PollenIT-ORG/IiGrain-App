import ApiError from "../utils/ApiError.js";
import { answerPayload, resolveAnswer, type AnswerPayload } from "./assessmentAnswer.js";
import {
  MAX_FORM_RECORDS,
  getProgramQuestionKind,
  listFormRecords,
  listRecordAnswers,
  saveFormAnswers,
  type QuestionWithAnswer,
  type RecordAnswerRow,
  type RecordTarget,
  type ResponseInput,
  type SavedResponse,
} from "../models/assessmentMobile.model.js";
import type { SaveAnswerBody } from "../validators/assessment.schema.js";

/** Whose form it is: one field, one program, one side, one category. */
export interface FormOwner {
  fieldId: string;
  programId: string;
  categoryId: string;
  authorRole: "farmer" | "assessor";
  authorId: string;
}

export type FormAnswer = SaveAnswerBody & { questionId: string };

/** One filling of a form, as the apps read it back. */
export interface RecordPayload {
  id: string;
  // 1 for the first record, 2 for the next, in the order they were added.
  number: number;
  // The evidence uploaded at the end of the form, for this record.
  evidenceUrls: string[];
  createdAt: string;
  updatedAt: string;
  answers: Array<{ questionId: string } & AnswerPayload>;
}

/** The records of one form, each with its answers, and the first one by question. */
export async function readFormRecords(owner: Omit<FormOwner, "authorId">): Promise<{
  records: RecordPayload[];
  firstByQuestion: Map<string, RecordAnswerRow>;
}> {
  const [records, answers] = await Promise.all([
    listFormRecords(owner.categoryId, owner.fieldId, owner.programId, owner.authorRole),
    listRecordAnswers(owner.categoryId, owner.fieldId, owner.programId, owner.authorRole),
  ]);

  const byRecord = new Map<string, RecordAnswerRow[]>();
  for (const a of answers) {
    const list = byRecord.get(a.record_id) ?? [];
    list.push(a);
    byRecord.set(a.record_id, list);
  }

  const firstByQuestion = new Map<string, RecordAnswerRow>();
  for (const a of byRecord.get(records[0]?.id ?? "") ?? []) firstByQuestion.set(a.question_id, a);

  return {
    records: records.map((r, index) => ({
      id: r.id,
      number: index + 1,
      evidenceUrls: r.evidence_urls ?? [],
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
      answers: (byRecord.get(r.id) ?? []).map((a) => ({ questionId: a.question_id, ...answerPayload(a) })),
    })),
    firstByQuestion,
  };
}

/** A question showing the answer its first record holds, as the single form screen reads it. */
export function withFirstRecord(
  question: QuestionWithAnswer,
  first: RecordAnswerRow | undefined
): QuestionWithAnswer {
  return {
    ...question,
    answered: Boolean(first),
    answer_score: first?.answer_score ?? null,
    answer_option_id: first?.answer_option_id ?? null,
    answer_text: first?.answer_text ?? null,
    answer_number: first?.answer_number ?? null,
    answer_date: first?.answer_date ?? null,
    answer_boolean: first?.answer_boolean ?? null,
    answer_comment: first?.answer_comment ?? null,
    answer_evidence_urls: first?.answer_evidence_urls ?? null,
  };
}

/**
 * Saves one form. An input based form saves into a record: the first one, a
 * new one or the one named. A multiple choice form has no records, so only
 * its plain save is allowed. Returns the record the answers went into.
 */
export async function saveForm(
  owner: FormOwner,
  questions: QuestionWithAnswer[],
  answers: FormAnswer[],
  target: RecordTarget,
  // The evidence at the end of the form; null clears it, undefined leaves it.
  formEvidence?: string[] | null
): Promise<{ recordId: string | null; saved: SavedResponse[] }> {
  const kind = await getProgramQuestionKind(owner.programId);
  if (kind === "mcq" && target.kind !== "first") {
    throw ApiError.badRequest("This assessment is answered once per question, so its forms have no records.");
  }
  const recordTarget = kind === "input" ? target : null;
  if (recordTarget?.kind === "new" && answers.length === 0) {
    throw ApiError.badRequest("Fill in at least one field to add a record.");
  }
  const evidence = formEvidence === null ? [] : formEvidence;
  if (evidence !== undefined && evidence.length > 5) {
    throw ApiError.badRequest("You can attach at most 5 files.");
  }

  // A photo or a note left out of this save is the one the record already holds.
  const stored = new Map<string, { evidenceUrls: string[]; comment: string | null }>();
  if (recordTarget && recordTarget.kind !== "new") {
    const { records, firstByQuestion } = await readFormRecords(owner);
    const record =
      recordTarget.kind === "id" ? records.find((r) => r.id === recordTarget.id) : records[0];
    if (recordTarget.kind === "id" && !record) {
      throw ApiError.notFound("That record is no longer there.");
    }
    if (recordTarget.kind === "id" && record) {
      for (const a of record.answers) {
        stored.set(a.questionId, { evidenceUrls: a.answerEvidenceUrls, comment: a.answerComment });
      }
    } else {
      for (const [questionId, a] of firstByQuestion) {
        stored.set(questionId, { evidenceUrls: a.answer_evidence_urls ?? [], comment: a.answer_comment });
      }
    }
  } else if (!recordTarget) {
    for (const q of questions) {
      stored.set(q.id, { evidenceUrls: q.answer_evidence_urls ?? [], comment: q.answer_comment });
    }
  }

  const byId = new Map(questions.map((q) => [q.id, q]));
  const rows: ResponseInput[] = answers.map((answer) => {
    const question = byId.get(answer.questionId);
    if (!question) throw ApiError.badRequest("One of the answers is not a field of this form.");
    const evidenceUrls = answer.evidenceUrls === null ? [] : answer.evidenceUrls;
    if (evidenceUrls !== undefined && evidenceUrls.length > 5) {
      throw ApiError.badRequest("You can attach at most 5 photos.");
    }
    const comment =
      answer.comment === undefined
        ? undefined
        : answer.comment && answer.comment.trim()
          ? answer.comment.trim()
          : null;
    const kept = stored.get(question.id);

    const values = resolveAnswer(
      {
        id: question.id,
        category_id: owner.categoryId,
        question_type: question.question_type,
        max_score: question.max_score,
        evidence_mode: question.evidence_mode,
        comment_mode: question.comment_mode,
        options: question.options.map((o) => ({ id: o.id, score: o.score })),
      },
      answer,
      {
        evidenceUrls: evidenceUrls ?? kept?.evidenceUrls ?? [],
        comment: comment === undefined ? kept?.comment ?? null : comment,
      }
    );

    return {
      fieldId: owner.fieldId,
      questionId: question.id,
      ...values,
      comment,
      evidenceUrls,
      authorRole: owner.authorRole,
      authorId: owner.authorId,
      programId: owner.programId,
    };
  });

  const saved = await saveFormAnswers(owner, recordTarget, rows, evidence);
  if (!saved.ok) {
    if (saved.reason === "missing") throw ApiError.notFound("That record is no longer there.");
    if (saved.reason === "full") {
      throw ApiError.badRequest(`A form can be filled in at most ${MAX_FORM_RECORDS} times.`);
    }
    throw ApiError.conflict("This assessment was just changed. Refresh and try again.");
  }
  return { recordId: saved.recordId, saved: saved.saved };
}
