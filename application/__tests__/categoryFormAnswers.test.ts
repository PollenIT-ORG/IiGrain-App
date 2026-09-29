import { buildFormAnswerEntry } from '../src/utils/answerPayload';
import { EMPTY_ANSWER_VALUE } from '../src/utils/answerValue';

describe('buildFormAnswerEntry', () => {
  it('is null for a field the farmer left blank', () => {
    const entry = buildFormAnswerEntry(
      'q1',
      { questionType: 'text', value: EMPTY_ANSWER_VALUE, comment: '', evidenceUrls: [] },
      null,
    );
    expect(entry).toBeNull();
  });

  it('carries the questionId plus the type-appropriate answer field', () => {
    const entry = buildFormAnswerEntry(
      'q2',
      {
        questionType: 'number',
        value: { ...EMPTY_ANSWER_VALUE, number: '4.5' },
        comment: '',
        evidenceUrls: [],
      },
      null,
    );
    expect(entry).toEqual({ questionId: 'q2', answerNumber: 4.5 });
  });

  it('sends score for a scored question', () => {
    const entry = buildFormAnswerEntry(
      'q-scored',
      { questionType: 'scored', value: { ...EMPTY_ANSWER_VALUE, score: 2 }, comment: '', evidenceUrls: [] },
      null,
    );
    expect(entry).toEqual({ questionId: 'q-scored', score: 2 });
  });

  it('sends optionId for an mcq question', () => {
    const entry = buildFormAnswerEntry(
      'q-mcq',
      {
        questionType: 'mcq',
        value: { ...EMPTY_ANSWER_VALUE, optionId: 'opt-b' },
        comment: '',
        evidenceUrls: [],
      },
      null,
    );
    expect(entry).toEqual({ questionId: 'q-mcq', optionId: 'opt-b' });
  });

  it('sends answerDate for a date question', () => {
    const entry = buildFormAnswerEntry(
      'q-date',
      {
        questionType: 'date',
        value: { ...EMPTY_ANSWER_VALUE, date: '2026-06-01' },
        comment: '',
        evidenceUrls: [],
      },
      null,
    );
    expect(entry).toEqual({ questionId: 'q-date', answerDate: '2026-06-01' });
  });

  it('only sends comment/evidence when they changed from the stored baseline', () => {
    const baseline = { comment: 'existing note', evidenceUrls: ['https://res.cloudinary.com/a.jpg'] };

    const unchanged = buildFormAnswerEntry(
      'q3',
      {
        questionType: 'boolean',
        value: { ...EMPTY_ANSWER_VALUE, boolean: true },
        comment: 'existing note',
        evidenceUrls: ['https://res.cloudinary.com/a.jpg'],
      },
      baseline,
    );
    expect(unchanged).toEqual({ questionId: 'q3', answerBoolean: true });

    const changed = buildFormAnswerEntry(
      'q3',
      {
        questionType: 'boolean',
        value: { ...EMPTY_ANSWER_VALUE, boolean: true },
        comment: 'a new note',
        evidenceUrls: [],
      },
      baseline,
    );
    expect(changed).toEqual({
      questionId: 'q3',
      answerBoolean: true,
      comment: 'a new note',
      evidenceUrls: null,
    });
  });
});
