import React, { useCallback } from 'react';
import Input from '../../Input/Input';
import { sanitizeNumberText } from '../../../utils/answerValue';

export interface NumberAnswerInputProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  label?: string;
}

const NumberAnswerInput: React.FC<NumberAnswerInputProps> = ({
  value,
  onChange,
  readOnly = false,
  label,
}) => {
  const handleChange = useCallback(
    (next: string) => onChange(sanitizeNumberText(next)),
    [onChange],
  );

  return (
    <Input
      label={label}
      value={value}
      onChangeText={handleChange}
      placeholder="Enter a number"
      keyboardType="decimal-pad"
      editable={!readOnly}
    />
  );
};

export default React.memo(NumberAnswerInput);
