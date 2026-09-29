/**
 * Generic form UX logic for input-based assessment categories: which fields
 * are invalid (and in what order), and where to resume a partly filled form.
 * Everything here is driven by the API payload - question order, questionType,
 * evidenceMode and commentMode - so no category, field name or index is ever
 * assumed.
 */
import {
  groupErrorsByQuestion,
  resumeQuestionId,
  validateCategoryForm,
  type FormAnswerState,
} from '../src/utils/categoryFormValidation';
import { EMPTY_ANSWER_VALUE } from '../src/utils/answerValue';
import type { AssessmentQuestionDetail, QuestionType } from '../src/types/assessment';

const question = (
  id: string,
  questionType: QuestionType,
  overrides: Partial<AssessmentQuestionDetail> = {},
): AssessmentQuestionDetail => ({
  id,
  code: id,
  text: `Question ${id}`,
  guidance: '',
  questionType,
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

const blank = (): FormAnswerState => ({
  value: EMPTY_ANSWER_VALUE,
  comment: '',
  evidenceUrls: [],
});

const withText = (text: string, extra: Partial<FormAnswerState> = {}): FormAnswerState => ({
  value: { ...EMPTY_ANSWER_VALUE, text },
  comment: '',
  evidenceUrls: [],
  ...extra,
});

/** Fills a field the way its own questionType expects, so "complete" means complete. */
const answeredFor = (questionType: QuestionType): FormAnswerState => {
  const value = { ...EMPTY_ANSWER_VALUE };
  switch (questionType) {
    case 'number':
      value.number = '6';
      break;
    case 'date':
      value.date = '2026-03-05';
      break;
    case 'boolean':
      value.boolean = false;
      break;
    case 'mcq':
      value.optionId = 'opt-1';
      break;
    case 'scored':
      value.score = 2;
      break;
    default:
      value.text = 'done';
  }
  return { value, comment: '', evidenceUrls: [] };
};

describe('validateCategoryForm', () => {
  it('ignores a field the farmer never touched, whatever its required modes', () => {
    const questions = [question('q1', 'text', { commentMode: 'required', evidenceMode: 'required' })];
    expect(validateCategoryForm(questions, { q1: blank() })).toEqual([]);
  });

  it('flags a photo attached to a field that has no answer, instead of dropping it', () => {
    const questions = [question('q1', 'text', { evidenceMode: 'optional' })];
    const fields = {
      q1: { ...blank(), evidenceUrls: ['https://res.cloudinary.com/a.jpg'] },
    };
    expect(validateCategoryForm(questions, fields)).toEqual([
      {
        questionId: 'q1',
        index: 1,
        kind: 'answer',
        message: 'Answer this field to save its photo or description',
      },
    ]);
  });

  it('flags a description written on a field that has no answer', () => {
    const questions = [question('q1', 'text', { commentMode: 'optional' })];
    const fields = { q1: { ...blank(), comment: 'a note without an answer' } };
    expect(validateCategoryForm(questions, fields).map(e => e.kind)).toEqual(['answer']);
  });

  it('stops flagging once the answer is filled in alongside the photo', () => {
    const questions = [question('q1', 'text', { evidenceMode: 'optional' })];
    const fields = {
      q1: withText('now answered', { evidenceUrls: ['https://res.cloudinary.com/a.jpg'] }),
    };
    expect(validateCategoryForm(questions, fields)).toEqual([]);
  });

  it('flags a filled field that is missing its required description', () => {
    const questions = [question('q1', 'text', { commentMode: 'required' })];
    const errors = validateCategoryForm(questions, { q1: withText('Looks healthy') });
    expect(errors).toEqual([
      { questionId: 'q1', index: 1, kind: 'comment', message: 'Description is required' },
    ]);
  });

  it('flags a filled field that is missing its required photo', () => {
    const questions = [question('q1', 'text', { evidenceMode: 'required' })];
    const errors = validateCategoryForm(questions, { q1: withText('Looks healthy') });
    expect(errors).toEqual([
      { questionId: 'q1', index: 1, kind: 'evidence', message: 'Photo is required' },
    ]);
  });

  it('accepts a filled field once its required description and photo are present', () => {
    const questions = [question('q1', 'text', { commentMode: 'required', evidenceMode: 'required' })];
    const fields = {
      q1: withText('Looks healthy', {
        comment: 'Two sessions',
        evidenceUrls: ['https://res.cloudinary.com/a.jpg'],
      }),
    };
    expect(validateCategoryForm(questions, fields)).toEqual([]);
  });

  it('reports every invalid field in the order the API returned them, with real indexes', () => {
    const questions = [
      question('a', 'text'),
      question('b', 'text', { evidenceMode: 'required' }),
      question('c', 'text'),
      question('d', 'text', { commentMode: 'required' }),
    ];
    const fields = {
      a: withText('ok'),
      b: withText('needs a photo'),
      c: blank(),
      d: withText('needs a description'),
    };

    const errors = validateCategoryForm(questions, fields);

    expect(errors.map(e => [e.questionId, e.index, e.kind])).toEqual([
      ['b', 2, 'evidence'],
      ['d', 4, 'comment'],
    ]);
  });

  it('groups both problems of one field under that field', () => {
    const questions = [question('q1', 'text', { commentMode: 'required', evidenceMode: 'required' })];
    const grouped = groupErrorsByQuestion(
      validateCategoryForm(questions, { q1: withText('filled') }),
    );
    expect(grouped).toEqual({
      q1: { comment: 'Description is required', evidence: 'Photo is required' },
    });
  });
});

describe('resumeQuestionId', () => {
  const six = [
    question('q1', 'text'),
    question('q2', 'number'),
    question('q3', 'date'),
    question('q4', 'boolean'),
    question('q5', 'text'),
    question('q6', 'long_text'),
  ];

  it('returns the first unanswered field when earlier ones are done', () => {
    const fields: Record<string, FormAnswerState> = {
      q1: answeredFor('text'),
      q2: answeredFor('number'),
      q3: answeredFor('date'),
      q4: answeredFor('boolean'),
      q5: blank(),
      q6: blank(),
    };
    expect(resumeQuestionId(six, fields)).toBe('q5');
  });

  it('returns null when every field is complete, so the form does not jump', () => {
    const fields = Object.fromEntries(six.map(q => [q.id, answeredFor(q.questionType)]));
    expect(resumeQuestionId(six, fields)).toBeNull();
  });

  it('returns null for a wholly empty form, so it opens at the top', () => {
    const fields = Object.fromEntries(six.map(q => [q.id, blank()]));
    expect(resumeQuestionId(six, fields)).toBeNull();
  });

  it('treats a field answered but missing its required photo as still needing work', () => {
    const questions = [
      question('q1', 'text'),
      question('q2', 'text', { evidenceMode: 'required' }),
      question('q3', 'text'),
    ];
    const fields = {
      q1: withText('done'),
      q2: withText('answered but no photo yet'),
      q3: blank(),
    };
    expect(resumeQuestionId(questions, fields)).toBe('q2');
  });

  it('skips an answered optional field and lands on the later incomplete one', () => {
    const questions = [
      question('q1', 'text'),
      question('q2', 'text', { commentMode: 'optional' }),
      question('q3', 'text', { commentMode: 'required' }),
    ];
    const fields = {
      q1: withText('done'),
      q2: withText('answered, comment left blank on purpose'),
      q3: withText('answered but description missing'),
    };
    expect(resumeQuestionId(questions, fields)).toBe('q3');
  });
});
