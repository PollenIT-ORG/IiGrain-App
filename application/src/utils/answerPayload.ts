import type { QuestionScore, SaveAnswerInput } from '../types/assessment';

export interface AnswerBaseline {
  comment: string | null;
  evidenceUrls: string[];
}

const sameUrls = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((url, i) => url === b[i]);

export const buildAnswerPayload = (
  score: QuestionScore,
  comment: string,
  evidenceUrls: string[],
  baseline: AnswerBaseline | null,
): SaveAnswerInput => {
  const body: SaveAnswerInput = { score };

  const nextComment = comment.trim();
  const prevComment = (baseline?.comment ?? '').trim();
  if (nextComment !== prevComment) {
    body.comment = nextComment === '' ? null : nextComment;
  }

  const prevUrls = baseline?.evidenceUrls ?? [];
  if (!sameUrls(evidenceUrls, prevUrls)) {
    body.evidenceUrls = evidenceUrls.length === 0 ? null : evidenceUrls;
  }

  return body;
};
