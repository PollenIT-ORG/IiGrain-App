import React from 'react';
import Input from '../../Input/Input';

const LONG_TEXT_MAX = 5000;
const COUNTER_AT = 0.7;

export interface LongTextAnswerInputProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  label?: string;
}

const LongTextAnswerInput: React.FC<LongTextAnswerInputProps> = ({
  value,
  onChange,
  readOnly = false,
  label,
}) => {
  const nearLimit = value.length >= Math.floor(LONG_TEXT_MAX * COUNTER_AT);
  return (
    <Input
      label={label}
      value={value}
      onChangeText={onChange}
      placeholder="Type your answer…"
      maxLength={LONG_TEXT_MAX}
      editable={!readOnly}
      multiline
      hint={nearLimit ? `${value.length}/${LONG_TEXT_MAX}` : undefined}
      hintTone={value.length >= LONG_TEXT_MAX ? 'warning' : 'muted'}
    />
  );
};

export default React.memo(LongTextAnswerInput);
