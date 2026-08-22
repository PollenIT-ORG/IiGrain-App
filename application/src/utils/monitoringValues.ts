import {
  NOTES_MAX_LENGTH,
  moduleDef,
  type MonitoringFieldDef,
} from '../config/monitoringModules';
import type {
  ModuleKey,
  ModuleStatus,
  MonitoringFieldErrors,
  MonitoringRecord,
  MonitoringValue,
  MonitoringValues,
  RecordPayload,
} from '../types/monitoring';


export type FormValue = string | boolean | null;

export type FormValues = Record<string, FormValue>;

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export const formatDateOnly = (value?: string | null): string => {
  const match = DATE_ONLY.exec((value ?? '').slice(0, 10));
  if (!match) {
    return '';
  }
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11) {
    return '';
  }
  return `${MONTHS_SHORT[month]} ${Number(match[3])}, ${match[1]}`;
};

export const toDateOnly = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.length < 10) {
    return null;
  }
  const sliced = value.slice(0, 10);
  return DATE_ONLY.test(sliced) ? sliced : null;
};

export const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const numberToText = (n: number): string => {
  if (!Number.isFinite(n)) {
    return '';
  }
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(8)));
};

export const hasValue = (value: MonitoringValue | undefined): boolean =>
  value !== null && value !== undefined && value !== '';


const optionLabel = (def: MonitoringFieldDef, raw: string): string =>
  def.options?.find(o => o.value === raw)?.label ?? raw;

export const displayValue = (
  def: MonitoringFieldDef,
  value: MonitoringValue | undefined,
): string => {
  if (!hasValue(value)) {
    return '';
  }
  switch (def.type) {
    case 'date':
      return formatDateOnly(String(value));
    case 'boolean':
      return value === true ? 'Yes' : 'No';
    case 'number': {
      const n = toNumberOrNull(value);
      if (n === null) {
        return '';
      }
      return def.unit ? `${numberToText(n)} ${def.unit}` : numberToText(n);
    }
    case 'select':
      return optionLabel(def, String(value));
    default:
      return String(value);
  }
};

export const labelledValue = (
  def: MonitoringFieldDef,
  value: MonitoringValue | undefined,
): string => {
  const shown = displayValue(def, value);
  return shown ? `${def.label}: ${shown}` : '';
};

export const summaryLine = (module: ModuleKey, record: MonitoringRecord): string => {
  const def = moduleDef(module);
  const parts: string[] = [];
  for (const key of def.summaryKeys) {
    const field = def.fields.find(f => f.key === key);
    if (!field) {
      continue;
    }
    const shown = displayValue(field, record.values[key]);
    if (shown) {
      parts.push(field.type === 'boolean' ? `${field.label} ${shown}` : shown);
    }
  }
  return parts.join(' · ');
};

export const recordTitle = (module: ModuleKey, record: MonitoringRecord): string => {
  const def = moduleDef(module);
  if (def.titleKey) {
    const field = def.fields.find(f => f.key === def.titleKey);
    const shown = field ? displayValue(field, record.values[def.titleKey]) : '';
    if (shown) {
      return shown;
    }
  }
  const dated = def.dateKey ? formatDateOnly(String(record.values[def.dateKey] ?? '')) : '';
  if (dated) {
    return dated;
  }
  return `Untitled ${def.noun}`;
};

export const recordDate = (module: ModuleKey, record: MonitoringRecord): string => {
  const def = moduleDef(module);
  return def.dateKey ? formatDateOnly(String(record.values[def.dateKey] ?? '')) : '';
};

export interface RecordCoords {
  latitude: number;
  longitude: number;
}

export const recordCoords = (
  module: ModuleKey,
  record: MonitoringRecord,
): RecordCoords | null => {
  const def = moduleDef(module);
  const latKey = def.fields.find(f => f.gpsPair === 'latitude')?.key;
  const lngKey = def.fields.find(f => f.gpsPair === 'longitude')?.key;
  if (!latKey || !lngKey) {
    return null;
  }
  const latitude = toNumberOrNull(record.values[latKey]);
  const longitude = toNumberOrNull(record.values[lngKey]);
  if (latitude === null || longitude === null) {
    return null;
  }
  return { latitude, longitude };
};

export const formatCoords = (latitude: number, longitude: number): string =>
  `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;


export const emptyForm = (module: ModuleKey): FormValues => {
  const values: FormValues = {};
  for (const field of moduleDef(module).fields) {
    values[field.key] = field.type === 'boolean' ? null : '';
  }
  return values;
};

export const formFromRecord = (
  module: ModuleKey,
  record: MonitoringRecord,
): FormValues => {
  const values: FormValues = {};
  for (const field of moduleDef(module).fields) {
    const raw = record.values[field.key];
    if (field.type === 'boolean') {
      values[field.key] = typeof raw === 'boolean' ? raw : null;
      continue;
    }
    if (!hasValue(raw)) {
      values[field.key] = '';
      continue;
    }
    if (field.type === 'number') {
      const n = toNumberOrNull(raw);
      values[field.key] = n === null ? '' : numberToText(n);
      continue;
    }
    values[field.key] = String(raw);
  }
  return values;
};

export const sanitizeNumberInput = (def: MonitoringFieldDef, text: string): string => {
  const negative = def.allowNegative && text.trim().startsWith('-');
  let digits = text.replace(/[^0-9.]/g, '');

  const firstDot = digits.indexOf('.');
  if (firstDot >= 0) {
    digits =
      digits.slice(0, firstDot + 1) + digits.slice(firstDot + 1).replace(/\./g, '');
  }

  const decimals = def.decimals ?? 0;
  const dot = digits.indexOf('.');
  if (dot >= 0) {
    if (decimals <= 0) {
      digits = digits.slice(0, dot);
    } else {
      digits = digits.slice(0, dot + 1 + decimals);
    }
  }

  return negative ? `-${digits}` : digits;
};


const nameOf = (def: MonitoringFieldDef): string => def.errorLabel ?? def.label;

const decimalsOf = (text: string): number => {
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : text.length - dot - 1;
};

const asText = (value: FormValue | undefined): string =>
  typeof value === 'string' ? value.trim() : '';

const PARTIAL_NUMBER = /^-?\.?$/;

const validateField = (
  def: MonitoringFieldDef,
  values: FormValues,
): string | undefined => {
  if (def.type === 'boolean') {
    return undefined;
  }

  const text = asText(values[def.key]);

  if (!text) {
    return def.required ? `${nameOf(def)} is required.` : undefined;
  }

  if (def.type === 'text' || def.type === 'select') {
    if (def.strictEnum && def.options && !def.options.some(o => o.value === text)) {
      return def.key === 'crop_type'
        ? 'Crop type must be cash, cover or forage.'
        : `${nameOf(def)} is not one of the accepted values.`;
    }
    if (def.maxLength && text.length > def.maxLength) {
      return `${nameOf(def)} is too long (limit ${def.maxLength}).`;
    }
    return undefined;
  }

  if (def.type === 'number') {
    if (PARTIAL_NUMBER.test(text)) {
      return undefined;
    }
    const n = Number(text);
    if (!Number.isFinite(n)) {
      return `${nameOf(def)} must be a number.`;
    }
    if (def.min !== undefined && n < def.min) {
      return `${nameOf(def)} cannot be less than ${def.min}.`;
    }
    if (def.max !== undefined && n > def.max) {
      return `${nameOf(def)} cannot be more than ${def.max}.`;
    }
    const allowed = def.decimals ?? 0;
    if (decimalsOf(text) > allowed) {
      return allowed === 0
        ? `${nameOf(def)} must be a whole number.`
        : `${nameOf(def)} can have at most ${allowed} decimal place${
            allowed === 1 ? '' : 's'
          }.`;
    }
    return undefined;
  }

  if (def.type === 'date') {
    if (!DATE_ONLY.test(text)) {
      return `${nameOf(def)} is not a valid date.`;
    }
    if (def.notBefore) {
      const other = asText(values[def.notBefore]);
      if (other && text < other) {
        return def.key === 'harvest_date'
          ? 'Harvest date cannot be before the planting date.'
          : `${nameOf(def)} cannot be before the ${def.notBefore.replace(/_/g, ' ')}.`;
      }
    }
  }

  return undefined;
};

export interface ValidationResult {
  errors: MonitoringFieldErrors;
  ok: boolean;
}

export const validateRecordForm = (
  module: ModuleKey,
  values: FormValues,
  notes: string,
): ValidationResult => {
  const errors: MonitoringFieldErrors = {};

  for (const def of moduleDef(module).fields) {
    const message = validateField(def, values);
    if (message) {
      errors[def.key] = message;
    }
  }

  if (notes.trim().length > NOTES_MAX_LENGTH) {
    errors.notes = `Notes are too long (limit ${NOTES_MAX_LENGTH}).`;
  }

  return { errors, ok: Object.keys(errors).length === 0 };
};

export const validateSingleField = (
  module: ModuleKey,
  key: string,
  values: FormValues,
): string | undefined => {
  const def = moduleDef(module).fields.find(f => f.key === key);
  return def ? validateField(def, values) : undefined;
};


export const buildPayload = (
  module: ModuleKey,
  values: FormValues,
  status: ModuleStatus,
  notes: string,
): RecordPayload => {
  const out: MonitoringValues = {};

  for (const def of moduleDef(module).fields) {
    const raw = values[def.key];

    if (def.type === 'boolean') {
      out[def.key] = typeof raw === 'boolean' ? raw : null;
      continue;
    }

    const text = asText(raw);
    if (!text) {
      out[def.key] = null;
      continue;
    }

    if (def.type === 'number') {
      const n = Number(text);
      out[def.key] = Number.isFinite(n) ? n : null;
      continue;
    }

    out[def.key] = text;
  }

  return { status, notes: notes.trim() || null, values: out };
};

const isFieldBlank = (
  def: MonitoringFieldDef,
  values: FormValues,
  autoFilled?: FormValues,
): boolean => {
  const raw = values[def.key];

  if (autoFilled && def.key in autoFilled && raw === autoFilled[def.key]) {
    return true;
  }

  if (def.type === 'boolean') {
    return raw === null || raw === undefined;
  }
  const text = asText(raw);
  return !text || (def.type === 'number' && PARTIAL_NUMBER.test(text));
};

export const isFormEmpty = (
  module: ModuleKey,
  values: FormValues,
  notes: string,
  autoFilled?: FormValues,
): boolean => {
  if (notes.trim()) {
    return false;
  }
  return moduleDef(module).fields.every(def => isFieldBlank(def, values, autoFilled));
};

export const filledFieldCount = (
  module: ModuleKey,
  values: FormValues,
  autoFilled?: FormValues,
): number =>
  moduleDef(module).fields.filter(def => !isFieldBlank(def, values, autoFilled)).length;

export const recordHasValues = (module: ModuleKey, record: MonitoringRecord): boolean =>
  moduleDef(module).fields.some(def => hasValue(record.values[def.key]));
