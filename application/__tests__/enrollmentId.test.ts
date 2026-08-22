import {
  formatEnrollmentIdInput,
  isEnrollmentIdShaped,
  normalizeEnrollmentId,
} from '../src/utils/enrollmentId';

describe('normalizeEnrollmentId', () => {
  it('upper-cases and strips whitespace so a pasted ID still works', () => {
    expect(normalizeEnrollmentId(' iig-2026-123456 ')).toBe('IIG-2026-123456');
    expect(normalizeEnrollmentId('IIG-2026\n-123456')).toBe('IIG-2026-123456');
  });
});

describe('formatEnrollmentIdInput', () => {
  it('groups IIG + digits as the farmer types', () => {
    expect(formatEnrollmentIdInput('iig')).toBe('IIG');
    expect(formatEnrollmentIdInput('iig2')).toBe('IIG-2');
    expect(formatEnrollmentIdInput('iig2026')).toBe('IIG-2026');
    expect(formatEnrollmentIdInput('iig2026482913')).toBe('IIG-2026-482913');
  });

  it('does not trap backspace on a dash it inserted', () => {
    expect(formatEnrollmentIdInput('IIG-')).toBe('IIG-');
    expect(formatEnrollmentIdInput('IIG')).toBe('IIG');
  });

  it('leaves an ID in any other format exactly as typed', () => {
    expect(formatEnrollmentIdInput('reg-2026-abc')).toBe('REG-2026-ABC');
    expect(formatEnrollmentIdInput('iig20264829131234')).toBe('IIG20264829131234');
  });

  it('never exceeds the length the server accepts', () => {
    expect(formatEnrollmentIdInput('X'.repeat(60))).toHaveLength(32);
  });
});

describe('isEnrollmentIdShaped', () => {
  it('recognises the canonical shape only', () => {
    expect(isEnrollmentIdShaped('iig-2026-482913')).toBe(true);
    expect(isEnrollmentIdShaped('IIG-2026-48291')).toBe(false);
    expect(isEnrollmentIdShaped('REG-2026-482913')).toBe(false);
  });
});
