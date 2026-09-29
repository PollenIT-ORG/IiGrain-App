/**
 * AnswerInput (components/assessment/questionTypes/AnswerInput.tsx) switches
 * on questionType to render the matching per-type input and normalizes every
 * type's raw change back into one AnswerLocalValue shape. These tests cover
 * the two types CategoryFormView's own test doesn't exercise (mcq, number),
 * so every question type has at least one test proving the dispatcher wires
 * the right component to the right onChange field.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import AnswerInput from '../src/components/assessment/questionTypes/AnswerInput';
import { EMPTY_ANSWER_VALUE } from '../src/utils/answerValue';
import type { QuestionOption } from '../src/types/assessment';

const mcqOptions: QuestionOption[] = [
  { id: 'opt-a', text: 'Option A', score: 1 },
  { id: 'opt-b', text: 'Option B', score: 2 },
];

describe('AnswerInput dispatch', () => {
  test('mcq: picking an option reports its id and leaves other fields untouched', () => {
    const onChange = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <AnswerInput
          questionType="mcq"
          value={EMPTY_ANSWER_VALUE}
          onChange={onChange}
          options={mcqOptions}
          scoreDescriptions={[]}
        />,
      );
    });

    act(() => tree.root.findByProps({ accessibilityLabel: 'Option A' }).props.onPress());

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_ANSWER_VALUE, optionId: 'opt-a' });

    act(() => tree.unmount());
  });

  test('number: typing a value reports the sanitized string on the number field', () => {
    const onChange = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <AnswerInput
          questionType="number"
          value={EMPTY_ANSWER_VALUE}
          onChange={onChange}
          options={[]}
          scoreDescriptions={[]}
        />,
      );
    });

    const inputs = tree.root.findAllByProps({ placeholder: 'Enter a number' });
    act(() => inputs[inputs.length - 1].props.onChangeText('12.5kg'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_ANSWER_VALUE, number: '12.5' });

    act(() => tree.unmount());
  });

  test('readOnly disables the mcq option presses', () => {
    const onChange = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <AnswerInput
          questionType="mcq"
          value={{ ...EMPTY_ANSWER_VALUE, optionId: 'opt-a' }}
          onChange={onChange}
          options={mcqOptions}
          scoreDescriptions={[]}
          readOnly
        />,
      );
    });

    const option = tree.root.findByProps({ accessibilityLabel: 'Option B' });
    expect(option.props.disabled).toBe(true);

    act(() => tree.unmount());
  });
});
