/**
 * Masks contact details shown before a person has proved who they are.
 * Enough to recognise your own address, not enough to harvest someone else's.
 */

const DOT = "•";

/** `edward@gmail.com` becomes `ed****@gm***.com`. */
export function maskEmail(email: string): string {
  const value = email.trim();
  const at = value.lastIndexOf("@");
  if (at < 1) return DOT.repeat(6);

  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";

  // A fixed run of dots, so the mask does not give away how long the real
  // value is.
  const keep = (s: string, n: number): string =>
    (s.length <= n ? s.charAt(0) : s.slice(0, n)) + DOT.repeat(4);

  return `${keep(local, 2)}@${keep(host, 2)}${tld}`;
}

/** `+919876543210` becomes `+91` then dots then the last two digits. */
export function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const value = phone.trim();
  if (value.length < 4) return DOT.repeat(4);
  const plus = value.startsWith("+") ? "+" : "";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return DOT.repeat(4);
  return `${plus}${digits.slice(0, 2)}${DOT.repeat(4)}${digits.slice(-2)}`;
}
