/**
 * missingAnswerReason (screens/assessment/shared/QuestionView.tsx) is the
 * per-question twin of CategoryFormView's inline validation messages
 * (categoryFormValidation.test.tsx) - it picks the toast shown when the
 * "Next"/"Save draft" button is pressed without a valid answer. Pure
 * branches, no rendering needed.
 */
import { missingAnswerReason } from '../src/screens/assessment/shared/QuestionView';
import { EMPTY_ANSWER_VALUE, type AnswerLocalValue } from '../src/utils/answerValue';
import type { AssessmentQuestionDetail, QuestionType } from '../src/types/assessment';

const detail = (overrides: Partial<AssessmentQuestionDetail>): AssessmentQuestionDetail => ({
  id: 'q1',
  code: '1',
  text: 'Sample question',
  guidance: '',
  questionType: 'text',
  maxScore: 3,
  options: [],
  evidenceMode: 'off',
  commentMode: 'off',
  scoreDescriptions: [],
  answerScore: null,
  answerOptionId: null,
  answerOptionText: null,
  answerText: null,
  answerNumber: null,
  answerDate: null,
  answerBoolean: null,
  answerComment: null,
  answerEvidenceUrls: [],
  reviewScore: null,
  finalScore: null,
  answered: false,
  locked: false,
  ...overrides,
});

describe('missingAnswerReason', () => {
  test('falls back to a generic message before the question detail has loaded', () => {
    expect(missingAnswerReason(null, EMPTY_ANSWER_VALUE, '', [])).toBe(
      'Please answer to continue',
    );
  });

  const unansweredCases: Array<[QuestionType, string]> = [
    ['scored', 'Please select a score to continue'],
    ['mcq', 'Please choose an answer to continue'],
    ['text', 'Please enter an answer to continue'],
    ['long_text', 'Please enter an answer to continue'],
    ['number', 'Please enter a number to continue'],
    ['date', 'Please select a date to continue'],
    ['boolean', 'Please select Yes or No to continue'],
  ];

  test.each(unansweredCases)('%s: prompts with the type-specific message when unanswered', (questionType, expected) => {
    const q = detail({ questionType });
    expect(missingAnswerReason(q, EMPTY_ANSWER_VALUE, '', [])).toBe(expected);
  });

  test('asks for a description when the answer is filled but the required comment is blank', () => {
    const q = detail({ questionType: 'text', commentMode: 'required' });
    const value: AnswerLocalValue = { ...EMPTY_ANSWER_VALUE, text: 'Looks healthy' };
    expect(missingAnswerReason(q, value, '', [])).toBe('Please add a description to continue');
  });

  test('asks for a photo when the answer and comment are fine but required evidence is missing', () => {
    const q = detail({ questionType: 'boolean', evidenceMode: 'required' });
    const value: AnswerLocalValue = { ...EMPTY_ANSWER_VALUE, boolean: true };
    expect(missingAnswerReason(q, value, '', [])).toBe('Please add a photo to continue');
  });

  test('falls back to the generic message once the answer is actually complete', () => {
    const q = detail({ questionType: 'boolean', commentMode: 'required', evidenceMode: 'required' });
    const value: AnswerLocalValue = { ...EMPTY_ANSWER_VALUE, boolean: true };
    expect(missingAnswerReason(q, value, 'all good', ['https://res.cloudinary.com/a.jpg'])).toBe(
      'Please answer to continue',
    );
  });
});
