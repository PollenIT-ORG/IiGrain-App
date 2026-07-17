import { useCallback, useMemo, useRef, useState } from 'react';
import type { FieldValidator } from '../utils/fieldValidators';

export type ValidatorMap<V> = { [K in keyof V]?: FieldValidator<V> };

export type FormErrors<V> = Partial<Record<keyof V, string>>;

export interface UseFormValidation<V> {
  errors: FormErrors<V>;
  validateField: (field: keyof V, override?: Partial<V>) => string | undefined;
  validateForm: (override?: Partial<V>) => boolean;
  clearFieldError: (field: keyof V) => void;
  setFieldError: (field: keyof V, message?: string) => void;
}

export function useFormValidation<V extends Record<string, string>>(
  values: V,
  validators: ValidatorMap<V>,
): UseFormValidation<V> {
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const validatorsRef = useRef(validators);
  validatorsRef.current = validators;

  const [errors, setErrors] = useState<FormErrors<V>>({});

  const applyError = useCallback((field: keyof V, message?: string) => {
    setErrors(prev => {
      if (message) {
        if (prev[field] === message) {
          return prev;
        }
        return { ...prev, [field]: message };
      }
      if (prev[field] === undefined) {
        return prev;
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const runValidator = useCallback((field: keyof V, merged: V): string | undefined => {
    const validator = validatorsRef.current[field];
    return validator ? validator(merged[field], merged) : undefined;
  }, []);

  const validateField = useCallback(
    (field: keyof V, override?: Partial<V>): string | undefined => {
      const merged = override ? { ...valuesRef.current, ...override } : valuesRef.current;
      const message = runValidator(field, merged);
      applyError(field, message);
      return message;
    },
    [runValidator, applyError],
  );

  const validateForm = useCallback(
    (override?: Partial<V>): boolean => {
      const merged = override ? { ...valuesRef.current, ...override } : valuesRef.current;
      const next: FormErrors<V> = {};
      let valid = true;
      (Object.keys(validatorsRef.current) as (keyof V)[]).forEach(field => {
        const message = runValidator(field, merged);
        if (message) {
          next[field] = message;
          valid = false;
        }
      });
      setErrors(next);
      return valid;
    },
    [runValidator],
  );

  const clearFieldError = useCallback(
    (field: keyof V) => applyError(field, undefined),
    [applyError],
  );

  const setFieldError = useCallback(
    (field: keyof V, message?: string) => applyError(field, message),
    [applyError],
  );

  return useMemo(
    () => ({ errors, validateField, validateForm, clearFieldError, setFieldError }),
    [errors, validateField, validateForm, clearFieldError, setFieldError],
  );
}
