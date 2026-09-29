const HEX = '0123456789abcdef';

const randomHex = (length: number): string => {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += HEX[Math.floor(Math.random() * 16)];
  }
  return out;
};

export const newLocalId = (): string => {
  const timeHigh = Date.now().toString(16).padStart(12, '0').slice(-12);
  const variant = HEX[8 + Math.floor(Math.random() * 4)];
  return `${timeHigh.slice(0, 8)}-${timeHigh.slice(8, 12)}-4${randomHex(3)}-${variant}${randomHex(
    3,
  )}-${randomHex(12)}`;
};

export const newIdempotencyKey = (): string => `${newLocalId()}-${randomHex(8)}`;

export const nowIso = (): string => new Date().toISOString();
