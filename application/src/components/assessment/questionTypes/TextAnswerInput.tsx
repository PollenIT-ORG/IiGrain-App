import React from 'react';
import Input from '../../Input/Input';

const TEXT_MAX = 500;
const COUNTER_AT = 0.7;

export interface TextAnswerInputProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  label?: string;
}

const TextAnswerInput: React.FC<TextAnswerInputProps> = ({
  value,
  onChange,
  readOnly = false,
  label,
}) => {
  const nearLimit = value.length >= Math.floor(TEXT_MAX * COUNTER_AT);
  return (
    <Input
      label={label}
      value={value}
      onChangeText={onChange}
      placeholder="Type your answer…"
      maxLength={TEXT_MAX}
      editable={!readOnly}
      hint={nearLimit ? `${value.length}/${TEXT_MAX}` : undefined}
      hintTone={value.length >= TEXT_MAX ? 'warning' : 'muted'}
    />
  );
};

export default React.memo(TextAnswerInput);
