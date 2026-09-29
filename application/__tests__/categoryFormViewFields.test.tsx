/**
 * CategoryFormView renders one card per question and threads a single stable
 * setField/setUploading pair into each React.memo-wrapped FormField, keyed by
 * questionId (see CategoryFormView.tsx). This test is a behavioral regression
 * guard for that wiring: it proves that answering two fields of different
 * types independently produces two correctly-attributed answers on save,
 * which would fail if a future change ever mixed up which field an edit
 * belongs to (e.g. reverting to a per-question inline callback that closes
 * over the wrong questionId).
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import CategoryFormView from '../src/screens/assessment/shared/CategoryFormView';
import type { AssessmentQuestionDetail, SaveFormAnswerInput } from '../src/types/assessment';

// Mounting the whole form runs past Jest's 5s default under a full parallel run.
jest.setTimeout(30000);

const baseQuestion: Omit<AssessmentQuestionDetail, 'id' | 'questionType' | 'text'> = {
  code: '',
  guidance: '',
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
};

const textQuestion: AssessmentQuestionDetail = {
  ...baseQuestion,
  id: 'q-text',
  questionType: 'text',
  text: 'How healthy does the soil look?',
};

const boolQuestion: AssessmentQuestionDetail = {
  ...baseQuestion,
  id: 'q-bool',
  questionType: 'boolean',
  text: 'Did you rotate crops this season?',
};

describe('CategoryFormView field isolation', () => {
  test('editing the text field and the boolean field independently saves both, correctly attributed', async () => {
    const onSave = jest.fn(async (_answers: SaveFormAnswerInput[]) => true);
    const onDone = jest.fn();

    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <CategoryFormView
          categoryName="Soil health"
          questions={[textQuestion, boolQuestion]}
          locked={false}
          saving={false}
          onSave={onSave}
          onDone={onDone}
        />,
      );
    });

    const textInputs = tree.root.findAllByProps({ placeholder: 'Type your answer…' });
    act(() => textInputs[textInputs.length - 1].props.onChangeText('Great, dark soil'));

    const yesButton = tree.root.findByProps({ accessibilityLabel: 'Yes' });
    act(() => yesButton.props.onPress());

    const saveButton = tree.root.findByProps({ title: 'Save form' });
    await act(async () => {
      await saveButton.props.onPress();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    const answers = onSave.mock.calls[0][0] as SaveFormAnswerInput[];
    expect(answers).toHaveLength(2);
    expect(answers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ questionId: 'q-text', answerText: 'Great, dark soil' }),
        expect.objectContaining({ questionId: 'q-bool', answerBoolean: true }),
      ]),
    );
    expect(onDone).toHaveBeenCalledTimes(1);

    act(() => tree.unmount());
  });

  test('picking No on the boolean field leaves the text field untouched', async () => {
    const onSave = jest.fn(async (_answers: SaveFormAnswerInput[]) => true);
    const onDone = jest.fn();

    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <CategoryFormView
          categoryName="Soil health"
          questions={[textQuestion, boolQuestion]}
          locked={false}
          saving={false}
          onSave={onSave}
          onDone={onDone}
        />,
      );
    });

    const noButton = tree.root.findByProps({ accessibilityLabel: 'No' });
    act(() => noButton.props.onPress());

    const saveButton = tree.root.findByProps({ title: 'Save form' });
    await act(async () => {
      await saveButton.props.onPress();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    const answers = onSave.mock.calls[0][0] as SaveFormAnswerInput[];
    expect(answers).toHaveLength(1);
    expect(answers[0]).toEqual(expect.objectContaining({ questionId: 'q-bool', answerBoolean: false }));

    act(() => tree.unmount());
  });
});
