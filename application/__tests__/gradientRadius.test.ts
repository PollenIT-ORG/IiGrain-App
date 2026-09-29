import { clampCornerRadius } from '../src/components/AppGradient/AppGradient';
import { borderRadius } from '../src/constants';

describe('clampCornerRadius', () => {
  it('keeps a pill radius inside the box instead of degenerating the shape', () => {
    expect(borderRadius.full).toBe(9999);
    expect(clampCornerRadius(borderRadius.full, 220, 52)).toBe(26);
  });

  it('makes a full-radius progress bar a true pill', () => {
    expect(clampCornerRadius(borderRadius.full, 300, 8)).toBe(4);
  });

  it('leaves an ordinary radius alone', () => {
    expect(clampCornerRadius(20, 220, 120)).toBe(20);
  });

  it('clamps on the shorter side', () => {
    expect(clampCornerRadius(100, 40, 200)).toBe(20);
    expect(clampCornerRadius(100, 200, 40)).toBe(20);
  });

  it('paints square corners before the box has been measured', () => {
    expect(clampCornerRadius(borderRadius.full, 0, 0)).toBe(0);
    expect(clampCornerRadius(borderRadius.full, 220, 0)).toBe(0);
  });

  it('treats a missing or negative radius as square', () => {
    expect(clampCornerRadius(0, 220, 52)).toBe(0);
    expect(clampCornerRadius(-8, 220, 52)).toBe(0);
    expect(clampCornerRadius(NaN, 220, 52)).toBe(0);
  });
});
