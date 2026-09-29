import { asOwnerUserId, isDatabaseReady } from '../db';
import type { AuthorRole } from '../db/types';
import type { SaveAnswerInput, SavedAnswer } from '../../types/assessment';
import { ensureLocalAssessmentScope } from './assessmentScope';
import { saveAnswerOffline } from './domainWrites';
import { logSync } from './syncLogger';

export interface OfflineAnswerContext {
  readonly userId: string | null | undefined;
  readonly programId: string;
  readonly fieldServerId: string;
  readonly farmServerId: string | null;
  readonly authorRole: AuthorRole;
  readonly fieldName?: string;
  readonly farmName?: string;
  readonly totalQuestions?: number;
}

const parseUrls = (raw: string): string[] => {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
};

export const saveAnswerForOffline = async (
  context: OfflineAnswerContext,
  questionId: string,
  input: SaveAnswerInput,
): Promise<SavedAnswer | null> => {
  if (!context.userId || !isDatabaseReady()) {
    return null;
  }

  try {
    const owner = asOwnerUserId(context.userId);
    const assessment = await ensureLocalAssessmentScope(owner, {
      programId: context.programId,
      fieldServerId: context.fieldServerId,
      farmServerId: context.farmServerId,
      authorRole: context.authorRole,
      fieldName: context.fieldName,
      farmName: context.farmName,
      totalQuestions: context.totalQuestions,
    });

    const answer = await saveAnswerOffline(owner, assessment, questionId, {
      score: input.score ?? 0,
      comment: input.comment ?? null,
      evidenceUrls: input.evidenceUrls ?? [],
    });

    logSync('entry_claimed', {
      entityType: 'assessment_answer',
      operation: 'queued_offline',
    });

    return {
      id: answer.server_id ?? answer.local_id,
      fieldId: context.fieldServerId,
      questionId,
      questionType: 'scored',
      score: answer.score as SavedAnswer['score'],
      optionId: null,
      answerText: null,
      answerNumber: null,
      answerDate: null,
      answerBoolean: null,
      comment: answer.comment ?? '',
      evidenceUrls: parseUrls(answer.evidence_urls_json),
      createdAtISO: answer.created_at,
      updatedAtISO: answer.updated_at,
    };
  } catch (error) {
    logSync('permanent_failure', {
      entityType: 'assessment_answer',
      reason: error instanceof Error ? error.message : 'offline save failed',
    });
    return null;
  }
};
