import { getApiErrorMessage } from "./api";

export function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

export { getApiErrorMessage };
