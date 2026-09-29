import { randomInt } from "node:crypto";

// Characters people misread when copying from an email are left out: no O or 0,
// no I, l or 1. What remains still gives plenty of room at this length.
const LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const ALL = LETTERS + DIGITS;

const LENGTH = 12;

function pick(pool: string): string {
  return pool[randomInt(pool.length)];
}

/**
 * The password emailed to an account somebody else created. It satisfies the
 * same rule the sign-up form applies, at least one letter and one digit, so it
 * can never be rejected on the way in.
 */
export function generateTempPassword(): string {
  const chars = [pick(LETTERS), pick(DIGITS)];
  while (chars.length < LENGTH) chars.push(pick(ALL));

  // Fisher-Yates, so the guaranteed letter and digit are not always first.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
