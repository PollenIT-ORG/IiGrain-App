import type { QuestionScore, SaveAnswerInput } from '../types/assessment';

/**
 * Builds the save-answer body against the value the server last gave us.
 *
 * The backend treats the three states differently:
 *
 *   key absent -> keep the stored value
 *   null       -> clear it
 *   a value    -> overwrite it
 *
 * So the client must only send a key it actually changed. Echoing the current
 * values back on every save (what the screens used to do) is a read-modify-write:
 * it silently reverts anything written between our GET and our PUT — by the
 * assessor, by another device, or by a retry — and a whitespace-only comment
 * would be trimmed away and stored as cleared.
 *
 * `baseline` is the answer as the server reported it (`questionDetail`).
 * Pass null when there is no baseline yet (a first-time answer); then any
 * non-empty value is sent and empty ones are omitted, so nothing is ever
 * needlessly cleared.
 */
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
    // Emptied on purpose -> clear it. Otherwise overwrite.
    body.comment = nextComment === '' ? null : nextComment;
  }

  const prevUrls = baseline?.evidenceUrls ?? [];
  if (!sameUrls(evidenceUrls, prevUrls)) {
    body.evidenceUrls = evidenceUrls.length === 0 ? null : evidenceUrls;
  }

  return body;
};
