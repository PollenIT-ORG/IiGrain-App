/**
 * docs/MOBILE-ASSESSMENT-TEMPLATE-KINDS.md: questionKind ("mcq" | "input") is
 * an explicit server field on the summary and the category-questions/save
 * responses - the app must trust it, not infer it. The doc's own example
 * payload shows why: an "input" kind category can contain a questionType
 * "mcq" field mixed in with date/text fields (a Tier question scored by an
 * option). A client-side inference that required every question in a
 * category to be an "input" type (text/long_text/number/date/boolean) would
 * misclassify that category as multiple-choice. These tests pin the mapper
 * reading questionKind straight from the wire, including that exact mixed
 * case, plus the "never null, defaults to mcq" fallback the doc guarantees.
 */
import { mapAssessmentSummary, mapCategoryQuestionSet } from '../src/api/assessmentMappers';
import {
  mapAssessorSummary,
  mapCategoryQuestionSet as mapAssessorCategoryQuestionSet,
} from '../src/api/assessorMappers';
import type {
  AssessmentSummaryPayload,
  RawAssessment,
  CategoryQuestionSetPayload,
} from '../src/api/assessmentMappers';

const baseAssessment: RawAssessment = {
  title: 'Regen Assessment 2026',
  year: 2026,
  status: 'not_started',
  totalQuestions: 6,
  answered: 0,
  percentage: 0,
};

const summaryWith = (assessment: RawAssessment): AssessmentSummaryPayload => ({
  field: { id: 'field-1', name: 'North Plot', farmId: 'farm-1', farmName: 'Home Farm' },
  assessment,
  categories: [],
});

describe('mapAssessmentSummary questionKind', () => {
  it('reads "input" from the summary', () => {
    const mapped = mapAssessmentSummary(summaryWith({ ...baseAssessment, questionKind: 'input' }));
    expect(mapped.assessment.questionKind).toBe('input');
  });

  it('reads "mcq" from the summary', () => {
    const mapped = mapAssessmentSummary(summaryWith({ ...baseAssessment, questionKind: 'mcq' }));
    expect(mapped.assessment.questionKind).toBe('mcq');
  });

  it('defaults to mcq for a legacy template that sends no questionKind at all', () => {
    const mapped = mapAssessmentSummary(summaryWith(baseAssessment));
    expect(mapped.assessment.questionKind).toBe('mcq');
  });

  it('defaults to mcq for any unrecognized value rather than trusting it blindly', () => {
    const mapped = mapAssessmentSummary(
      summaryWith({ ...baseAssessment, questionKind: 'something-new' }),
    );
    expect(mapped.assessment.questionKind).toBe('mcq');
  });
});

describe('mapCategoryQuestionSet questionKind', () => {
  const trainings: CategoryQuestionSetPayload = {
    field: { id: 'b35980ec', name: 'ZZ Cascade Field' },
    category: { id: '57135f1e', name: 'Trainings' },
    progress: { totalQuestions: 3, answered: 3, percentage: 100 },
    questionKind: 'input',
    questions: [
      {
        id: 'tr1',
        questionCode: 'tr1',
        questionText: 'Date of the training',
        guidanceNote: '',
        questionType: 'date',
        scoreDescriptions: {},
        answerScore: null,
        answerDate: '2026-03-05',
        answerComment: null,
        answerEvidenceUrls: [],
        answered: true,
      },
      {
        id: 'tr5',
        questionCode: 'tr5',
        questionText: 'Attendance sheet',
        guidanceNote: '',
        questionType: 'text',
        scoreDescriptions: {},
        answerScore: null,
        answerText: 'Signed sheet',
        answerComment: null,
        answerEvidenceUrls: ['https://res.cloudinary.com/x/sheet.jpg'],
        answered: true,
      },
      {
        id: 'tr6',
        questionCode: 'tr6',
        questionText: 'Tier',
        guidanceNote: '',
        questionType: 'mcq',
        options: [
          { id: '6ca99feb', text: 'Bronze', score: 2 },
          { id: 'f09b56cd', text: 'Silver', score: 3 },
        ],
        scoreDescriptions: {},
        answerScore: 3,
        answerOptionId: 'f09b56cd',
        answerComment: null,
        answerEvidenceUrls: [],
        answered: true,
      },
    ],
  };

  it('is "input" even though the category mixes an mcq-type field with input-type fields', () => {
    const mapped = mapCategoryQuestionSet(trainings);
    expect(mapped.questionKind).toBe('input');
    expect(mapped.questions.map(q => q.questionType)).toEqual(['date', 'text', 'mcq']);
  });

  it('maps the mcq field inside the input-based form with its own answer, not a score-only shape', () => {
    const mapped = mapCategoryQuestionSet(trainings);
    const tier = mapped.questions.find(q => q.id === 'tr6');
    expect(tier).toMatchObject({
      questionType: 'mcq',
      answerOptionId: 'f09b56cd',
      answerScore: 3,
      answered: true,
    });
  });

  it('reports null when the payload states no questionKind, so the summary can stand in', () => {
    const withoutKind: CategoryQuestionSetPayload = { ...trainings, questionKind: undefined };
    const mapped = mapCategoryQuestionSet(withoutKind);
    expect(mapped.questionKind).toBeNull();
  });
});

describe('assessor category payload', () => {
  /**
   * getAssessorCategoryQuestions (the assessor's full-detail /questions route)
   * returns no questionKind, unlike its own summary and /questions/list and
   * unlike the farmer's equivalent. It has to read as "not stated" rather than
   * "mcq", or the assessor is sent to the question-by-question screen for an
   * input template.
   */
  it('reads a missing questionKind as not stated', () => {
    const mapped = mapAssessorCategoryQuestionSet({
      field: { id: 'f1', name: 'ZZ Cascade Field' },
      category: { id: 'c1', name: 'Trainings' },
      progress: { totalQuestions: 1, answered: 0, percentage: 0 },
      questions: [],
    });
    expect(mapped.questionKind).toBeNull();
  });

  it('still honours an explicit questionKind when the assessor route sends one', () => {
    const mapped = mapAssessorCategoryQuestionSet({
      field: { id: 'f1', name: 'ZZ Cascade Field' },
      category: { id: 'c1', name: 'Trainings' },
      progress: { totalQuestions: 1, answered: 0, percentage: 0 },
      questionKind: 'input',
      questions: [],
    });
    expect(mapped.questionKind).toBe('input');
  });

  it('carries questionKind on the assessor summary, which is the fallback source', () => {
    const mapped = mapAssessorSummary({
      field: { id: 'f1', name: 'ZZ Cascade Field' },
      farmer: { id: 'u1', name: 'Asha' },
      assessment: {
        title: '2026 Annual Assessment (Assessor)',
        year: 2026,
        status: 'in_progress',
        totalQuestions: 6,
        answered: 3,
        percentage: 50,
        questionKind: 'input',
      },
      categories: [],
    });
    expect(mapped.summary.assessment.questionKind).toBe('input');
  });
});
