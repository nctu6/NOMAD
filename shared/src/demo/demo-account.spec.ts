import { DEMO_ACCOUNT_EMAILS, isDemoAccountEmail } from './demo-account';

import { describe, expect, it } from 'vitest';

describe('isDemoAccountEmail', () => {
  it('knows the current and the pre-rename demo address', () => {
    expect(DEMO_ACCOUNT_EMAILS).toEqual(['demo@trek.app', 'demo@nomad.app']);
    expect(isDemoAccountEmail('demo@trek.app')).toBe(true);
    expect(isDemoAccountEmail('demo@nomad.app')).toBe(true);
  });

  it('is false for every other address and for none at all', () => {
    expect(isDemoAccountEmail('admin@trek.app')).toBe(false);
    expect(isDemoAccountEmail('DEMO@trek.app')).toBe(false);
    expect(isDemoAccountEmail('')).toBe(false);
    expect(isDemoAccountEmail(null)).toBe(false);
    expect(isDemoAccountEmail(undefined)).toBe(false);
  });
});
