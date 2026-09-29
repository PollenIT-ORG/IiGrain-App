/**
 * CategoryFormView.handleSave blocks the whole form save when a *filled*
 * field's required comment or required evidence is missing (an unfilled
 * field is simply skipped, per the "fill in whatever you have" design).
 * This is real gating logic a farmer hits directly, and had no coverage -
 * categoryFormViewFields.test.tsx only used commentMode/evidenceMode 'off'
 * fields, which never exercises these branches.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import CategoryFormView from '../src/screens/assessment/shared/CategoryFormView';
import { setToastHandler } from '../src/services/toastService';
import type { AssessmentQuestionDetail, SaveFormAnswerInput } from '../src/types/assessment';

const baseQuestion: Omit<AssessmentQuestionDetail, 'id' | 'questionType' | 'text' | 'commentMode' | 'evidenceMode'> = {
  code: '',
  guidance: '',
  maxScore: 3,
  options: [],
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

// Mounting the whole form four times runs past Jest's 5s default when the
// suite is competing with the rest of the run.
jest.setTimeout(30000);

const toasts: string[] = [];

beforeEach(() => {
  toasts.length = 0;
  setToastHandler(message => toasts.push(message));
});

afterEach(() => {
  setToastHandler(null);
});

describe('CategoryFormView required-field gating', () => {
  test('blocks save and reports which question needs a description', async () => {
    const question: AssessmentQuestionDetail = {
      ...baseQuestion,
      id: 'q-req-comment',
      questionType: 'text',
      text: 'Describe the crop condition',
      commentMode: 'required',
      evidenceMode: 'off',
    };
    const onSave = jest.fn(async (_answers: SaveFormAnswerInput[]) => true);
    const onDone = jest.fn();

    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <CategoryFormView
          categoryName="Soil health"
          questions={[question]}
          locked={false}
          saving={false}
          onSave={onSave}
          onDone={onDone}
        />,
      );
    });

    const textInputs = tree.root.findAllByProps({ placeholder: 'Type your answer…' });
    act(() => textInputs[textInputs.length - 1].props.onChangeText('Looks healthy'));

    const saveButton = tree.root.findByProps({ title: 'Save form' });
    await act(async () => {
      await saveButton.props.onPress();
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(toasts).toEqual(['Field 1: Description is required']);

    act(() => tree.unmount());
  });

  test('adding the required description lets the save through', async () => {
    const question: AssessmentQuestionDetail = {
      ...baseQuestion,
      id: 'q-req-comment',
      questionType: 'text',
      text: 'Describe the crop condition',
      commentMode: 'required',
      evidenceMode: 'off',
    };
    const onSave = jest.fn(async (_answers: SaveFormAnswerInput[]) => true);
    const onDone = jest.fn();

    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <CategoryFormView
          categoryName="Soil health"
          questions={[question]}
          locked={false}
          saving={false}
          onSave={onSave}
          onDone={onDone}
        />,
      );
    });

    const textInputs = tree.root.findAllByProps({ placeholder: 'Type your answer…' });
    act(() => textInputs[textInputs.length - 1].props.onChangeText('Looks healthy'));

    const commentInputs = tree.root.findAllByProps({ placeholder: 'Add a description…' });
    act(() => commentInputs[commentInputs.length - 1].props.onChangeText('Deep green, no wilting'));

    const saveButton = tree.root.findByProps({ title: 'Save form' });
    await act(async () => {
      await saveButton.props.onPress();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    const answers = onSave.mock.calls[0][0] as SaveFormAnswerInput[];
    expect(answers).toEqual([
      expect.objectContaining({
        questionId: 'q-req-comment',
        answerText: 'Looks healthy',
        comment: 'Deep green, no wilting',
      }),
    ]);
    expect(onDone).toHaveBeenCalledTimes(1);

    act(() => tree.unmount());
  });

  test('blocks save and reports which question needs a photo', async () => {
    const question: AssessmentQuestionDetail = {
      ...baseQuestion,
      id: 'q-req-evidence',
      questionType: 'boolean',
      text: 'Did you rotate crops this season?',
      commentMode: 'off',
      evidenceMode: 'required',
    };
    const onSave = jest.fn(async (_answers: SaveFormAnswerInput[]) => true);
    const onDone = jest.fn();

    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <CategoryFormView
          categoryName="Soil health"
          questions={[question]}
          locked={false}
          saving={false}
          onSave={onSave}
          onDone={onDone}
        />,
      );
    });

    const yesButton = tree.root.findByProps({ accessibilityLabel: 'Yes' });
    act(() => yesButton.props.onPress());

    const saveButton = tree.root.findByProps({ title: 'Save form' });
    await act(async () => {
      await saveButton.props.onPress();
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(toasts).toEqual(['Field 1: Photo is required']);

    act(() => tree.unmount());
  });

  test('leaving an optional-comment field blank still saves', async () => {
    const question: AssessmentQuestionDetail = {
      ...baseQuestion,
      id: 'q-optional-comment',
      questionType: 'boolean',
      text: 'Did you rotate crops this season?',
      commentMode: 'optional',
      evidenceMode: 'off',
    };
    const onSave = jest.fn(async (_answers: SaveFormAnswerInput[]) => true);
    const onDone = jest.fn();

    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <CategoryFormView
          categoryName="Soil health"
          questions={[question]}
          locked={false}
          saving={false}
          onSave={onSave}
          onDone={onDone}
        />,
      );
    });

    const yesButton = tree.root.findByProps({ accessibilityLabel: 'Yes' });
    act(() => yesButton.props.onPress());

    const saveButton = tree.root.findByProps({ title: 'Save form' });
    await act(async () => {
      await saveButton.props.onPress();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(toasts).toEqual(['Form saved']);

    act(() => tree.unmount());
  });
});
