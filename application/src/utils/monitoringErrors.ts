import type { MonitoringError } from '../redux/thunks/monitoringThunks';

const failureFor = (subject: string, error?: MonitoringError | null): string => {
  const status = error?.status ?? null;

  if (status === null) {
    return `You appear to be offline. Reconnect and delete this ${subject} again.`;
  }

  if (status === 401) {
    return 'Your session has expired. Please sign in and try again.';
  }

  if (status === 403) {
    return `You do not have permission to delete this ${subject}.`;
  }

  if (status === 409) {
    return `This ${subject} cannot be deleted while it is still in use.`;
  }

  if (status === 400 || status === 422) {
    return `We could not delete this ${subject}. Pull down to refresh, then try again.`;
  }

  if (status >= 500) {
    return `The server could not delete this ${subject} just now. Please try again in a moment.`;
  }

  const said = error?.message?.trim();
  return said || `We could not delete this ${subject}. Please try again.`;
};

export const deleteRecordFailure = (
  noun: string,
  error?: MonitoringError | null,
): string => failureFor(noun, error);

export const deleteDocumentFailure = (error?: MonitoringError | null): string =>
  failureFor('file', error);
