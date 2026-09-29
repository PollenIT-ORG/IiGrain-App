/**
 * The multi-entry form reuses CategoryFormView unchanged by overlaying one
 * record's answers onto the question list. These tests pin that overlay: an
 * existing entry opens pre-filled, a new entry opens blank, and the baseline
 * the save diff compares against moves with the record.
 */
import { questionsForRecord, recordAnsweredCount } from '../src/utils/recordAnswers';
import type {
  AssessmentQuestionDetail,
  AssessmentRecord,
} from '../src/types/assessment';

const question = (
  id: string,
  overrides: Partial<AssessmentQuestionDetail> = {},
): AssessmentQuestionDetail => ({
  id,
  code: id.toUpperCase(),
  text: `Question ${id}`,
  guidance: '',
  questionType: 'text',
  maxScore: 0,
  options: [],
  evidenceMode: 'optional',
  commentMode: 'optional',
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

const record: AssessmentRecord = {
  id: 'rec-2',
  number: 2,
  evidenceUrls: ['https://cdn.example/form.pdf'],
  createdAtISO: '2026-01-02T00:00:00.000Z',
  updatedAtISO: '2026-01-03T00:00:00.000Z',
  answers: [
    {
      questionId: 'q1',
      score: null,
      optionId: null,
      optionText: null,
      answerText: 'Drip irrigation',
      answerNumber: null,
      answerDate: null,
      answerBoolean: null,
      comment: 'Ran over two days',
      evidenceUrls: ['https://cdn.example/photo.jpg'],
    },
  ],
};

describe('questionsForRecord', () => {
  it('fills each question from the matching answer in that record', () => {
    const [q1] = questionsForRecord([question('q1')], record);

    expect(q1.answerText).toBe('Drip irrigation');
    expect(q1.answerComment).toBe('Ran over two days');
    expect(q1.answerEvidenceUrls).toEqual(['https://cdn.example/photo.jpg']);
    expect(q1.answered).toBe(true);
  });

  it('blanks a question the record has no answer for', () => {
    const [q2] = questionsForRecord([question('q2')], record);

    expect(q2.answerText).toBeNull();
    expect(q2.answerComment).toBeNull();
    expect(q2.answerEvidenceUrls).toEqual([]);
    expect(q2.answered).toBe(false);
  });

  it('blanks every question for a new entry, ignoring answers already on the question', () => {
    const prefilled = question('q1', {
      answerText: 'From the first entry',
      answerComment: 'Old note',
      answerEvidenceUrls: ['https://cdn.example/old.jpg'],
      answered: true,
    });

    const [fresh] = questionsForRecord([prefilled], null);

    expect(fresh.answerText).toBeNull();
    expect(fresh.answerComment).toBeNull();
    expect(fresh.answerEvidenceUrls).toEqual([]);
    expect(fresh.answered).toBe(false);
  });

  it('leaves the question definition itself untouched', () => {
    const source = question('q1', { questionType: 'number', evidenceMode: 'required' });
    const [mapped] = questionsForRecord([source], record);

    expect(mapped.questionType).toBe('number');
    expect(mapped.evidenceMode).toBe('required');
    expect(mapped.text).toBe(source.text);
    expect(source.answerText).toBeNull();
  });
});

describe('recordAnsweredCount', () => {
  it('counts only answers that still belong to the category', () => {
    const questions = [question('q1'), question('q2')];

    expect(recordAnsweredCount(questions, record)).toBe(1);
  });

  it('ignores answers for questions that were removed from the template', () => {
    expect(recordAnsweredCount([question('q2')], record)).toBe(0);
  });
});
