import React from 'react';
import AppDatePicker from '../../AppDatePicker';

export interface DateAnswerInputProps {
  value: string | null;
  onChange: (value: string) => void;
  readOnly?: boolean;
  label?: string;
}

const DateAnswerInput: React.FC<DateAnswerInputProps> = ({
  value,
  onChange,
  readOnly = false,
  label,
}) => (
  <AppDatePicker
    label={label}
    value={value}
    onChange={onChange}
    disabled={readOnly}
    placeholder="Select date"
  />
);

export default React.memo(DateAnswerInput);
