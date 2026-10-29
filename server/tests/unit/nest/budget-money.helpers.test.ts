import { customSplitCents } from '../../../src/nest/budget/budget-money.helpers';

import { describe, expect, it } from 'vitest';

const isk = (amount: number) => amount / 136.34;

describe('customSplitCents', () => {
  it('allocates a split that adds up against the credited cents, ties to the lower user id', () => {
    const members = [4, 1, 3, 2].map((user_id) => ({ user_id, amount: 34000 }));
    expect(customSplitCents(members, isk, 99751, 13600000)).toEqual({ 1: 24938, 2: 24938, 3: 24938, 4: 24937 });
  });

  it('takes cents back from the smallest fractions when the credit rounded down', () => {
    const members = [
      { user_id: 1, amount: 0.5 },
      { user_id: 2, amount: 0.5 },
    ];
    expect(customSplitCents(members, (a) => a * 1.005, 99, 100)).toEqual({ 1: 49, 2: 50 });
  });

  it('keeps the member-by-member rounding for a split that does not add up to the payers', () => {
    const members = [
      { user_id: 1, amount: 34000 },
      { user_id: 2, amount: null },
    ];
    expect(customSplitCents(members, isk, 99751, 13600000)).toEqual({ 1: 24938, 2: 0 });
  });

  it('splits nothing among nobody', () => {
    expect(customSplitCents([], isk, 100, 100)).toEqual({});
  });
});
