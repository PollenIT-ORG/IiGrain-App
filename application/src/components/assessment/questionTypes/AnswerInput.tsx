import React, { useCallback } from 'react';
import ScoreSelector from '../ScoreSelector';
import McqSelector from './McqSelector';
import TextAnswerInput from './TextAnswerInput';
import LongTextAnswerInput from './LongTextAnswerInput';
import NumberAnswerInput from './NumberAnswerInput';
import DateAnswerInput from './DateAnswerInput';
import BooleanAnswerInput from './BooleanAnswerInput';
import type {
  QuestionOption,
  QuestionScoreDescription,
  QuestionType,
} from '../../../types/assessment';
import type { AnswerLocalValue } from '../../../utils/answerValue';

export interface AnswerInputProps {
  questionType: QuestionType;
  value: AnswerLocalValue;
  onChange: (value: AnswerLocalValue) => void;
  options: QuestionOption[];
  scoreDescriptions: QuestionScoreDescription[];
  readOnly?: boolean;
  /** Forwarded to the underlying field's own label (text/long_text/number/date only). */
  label?: string;
}

const AnswerInput: React.FC<AnswerInputProps> = ({
  questionType,
  value,
  onChange,
  options,
  scoreDescriptions,
  readOnly = false,
  label,
}) => {
  const setScore = useCallback(
    (score: AnswerLocalValue['score']) => onChange({ ...value, score }),
    [onChange, value],
  );
  const setOptionId = useCallback(
    (optionId: string) => onChange({ ...value, optionId }),
    [onChange, value],
  );
  const setText = useCallback(
    (text: string) => onChange({ ...value, text }),
    [onChange, value],
  );
  const setNumber = useCallback(
    (number: string) => onChange({ ...value, number }),
    [onChange, value],
  );
  const setDate = useCallback(
    (date: string) => onChange({ ...value, date }),
    [onChange, value],
  );
  const setBoolean = useCallback(
    (bool: boolean | null) => onChange({ ...value, boolean: bool }),
    [onChange, value],
  );

  switch (questionType) {
    case 'mcq':
      return (
        <McqSelector
          value={value.optionId}
          options={options}
          onChange={setOptionId}
          readOnly={readOnly}
        />
      );
    case 'text':
      return (
        <TextAnswerInput value={value.text} onChange={setText} readOnly={readOnly} label={label} />
      );
    case 'long_text':
      return (
        <LongTextAnswerInput
          value={value.text}
          onChange={setText}
          readOnly={readOnly}
          label={label}
        />
      );
    case 'number':
      return (
        <NumberAnswerInput
          value={value.number}
          onChange={setNumber}
          readOnly={readOnly}
          label={label}
        />
      );
    case 'date':
      return (
        <DateAnswerInput value={value.date} onChange={setDate} readOnly={readOnly} label={label} />
      );
    case 'boolean':
      return (
        <BooleanAnswerInput value={value.boolean} onChange={setBoolean} readOnly={readOnly} />
      );
    case 'scored':
    default:
      return (
        <ScoreSelector
          value={value.score}
          onChange={setScore}
          readOnly={readOnly}
          descriptions={scoreDescriptions}
        />
      );
  }
};

export default React.memo(AnswerInput);
