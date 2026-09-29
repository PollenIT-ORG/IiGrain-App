/**
 * diffMeta (screens/assessment/FarmerComparisonScreen.tsx) decides the badge
 * a farmer sees comparing their own answer against the assessor's: dash when
 * either side hasn't answered, "Match" on agreement, and a signed delta
 * colored warning (1 point) or danger (2+ points) otherwise. These are pure
 * branches with no rendering involved, so they're covered directly rather
 * than through a full screen mount.
 */
import { diffMeta } from '../src/screens/assessment/FarmerComparisonScreen';
import { COLORS } from '../src/constants';
import type { ComparisonQuestion } from '../src/types/assessor';

const question = (overrides: Partial<ComparisonQuestion>): ComparisonQuestion => ({
  id: 'q1',
  code: '1',
  text: 'Sample question',
  farmerScore: null,
  assessorScore: null,
  farmerAnswered: false,
  assessorAnswered: false,
  difference: null,
  ...overrides,
});

describe('diffMeta', () => {
  test('dashes when the farmer has not answered', () => {
    const result = diffMeta(
      question({ farmerAnswered: false, assessorAnswered: true, assessorScore: 2 }),
    );
    expect(result).toEqual({ text: '—', color: COLORS.gray500, icon: 'minus' });
  });

  test('dashes when the assessor has not answered', () => {
    const result = diffMeta(
      question({ farmerAnswered: true, farmerScore: 2, assessorAnswered: false }),
    );
    expect(result).toEqual({ text: '—', color: COLORS.gray500, icon: 'minus' });
  });

  test('dashes when difference is null even though both answered', () => {
    const result = diffMeta(
      question({
        farmerAnswered: true,
        assessorAnswered: true,
        farmerScore: 2,
        assessorScore: 2,
        difference: null,
      }),
    );
    expect(result).toEqual({ text: '—', color: COLORS.gray500, icon: 'minus' });
  });

  test('reports a match when scores agree', () => {
    const result = diffMeta(
      question({
        farmerAnswered: true,
        assessorAnswered: true,
        farmerScore: 2,
        assessorScore: 2,
        difference: 0,
      }),
    );
    expect(result).toEqual({ text: 'Match', color: COLORS.success, icon: 'equal' });
  });

  test('a 1-point gap is a warning, signed and pointing up', () => {
    const result = diffMeta(
      question({
        farmerAnswered: true,
        assessorAnswered: true,
        farmerScore: 3,
        assessorScore: 2,
        difference: 1,
      }),
    );
    expect(result).toEqual({ text: '+1', color: COLORS.warning, icon: 'arrow-up' });
  });

  test('a 2-point gap is a danger, signed and pointing down', () => {
    const result = diffMeta(
      question({
        farmerAnswered: true,
        assessorAnswered: true,
        farmerScore: 0,
        assessorScore: 2,
        difference: -2,
      }),
    );
    expect(result).toEqual({ text: '-2', color: COLORS.danger, icon: 'arrow-down' });
  });
});
