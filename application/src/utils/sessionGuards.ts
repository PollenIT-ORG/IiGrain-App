export type AccountRevocation = 'deactivated' | 'unavailable';

const DEACTIVATED = /deactivat/i;
const UNAVAILABLE = /no longer available|account (has been )?(deleted|removed)/i;

export const accountRevocationFor = (
  status: number | null,
  message: string | null | undefined,
): AccountRevocation | null => {
  const text = message ?? '';
  if (status === 403 && DEACTIVATED.test(text)) {
    return 'deactivated';
  }
  if (status === 401 && UNAVAILABLE.test(text)) {
    return 'unavailable';
  }
  return null;
};
