import en from '@trek/shared/i18n/en';
import { describe, expect, it } from 'vitest';
import { DEMO_FEATURES, DEMO_FULL_VERSION, DEMO_LIMITS, formatCountdown, secondsUntilReset } from './demoWelcomeModel';

describe('demo welcome model', () => {
  it('FE-DEMO-MODEL-001: every tile and line names a key the English catalogue holds', () => {
    const keys = [
      ...DEMO_FEATURES.flatMap((f) => [f.titleKey, f.bodyKey]),
      ...DEMO_LIMITS.map((l) => l.labelKey),
      ...DEMO_FULL_VERSION.map((l) => l.labelKey),
    ];
    for (const key of keys) expect(Object.keys(en), key).toContain(key);
  });

  it('FE-DEMO-MODEL-002: shows the highlights a visitor can open, each once', () => {
    expect(DEMO_FEATURES.map((f) => f.id)).toEqual([
      'planner',
      'tours',
      'studio',
      'collab',
      'journey',
      'atlas',
      'vacay',
      'collections',
      'offline',
    ]);
  });

  it('FE-DEMO-MODEL-003: names everything the demo account cannot do', () => {
    expect(DEMO_LIMITS.map((l) => l.labelKey)).toEqual([
      'demo.limit.uploads',
      'demo.limit.account',
      'demo.limit.apiKeys',
      'demo.limit.mcp',
      'demo.limit.ai',
    ]);
  });

  it('FE-DEMO-MODEL-004: counts down to the next full hour in the server zone', () => {
    const at = new Date(Date.UTC(2026, 9, 24, 12, 17, 53));
    expect(secondsUntilReset(at, 'UTC')).toBe(42 * 60 + 7);
    // A zone half an hour off UTC has its hour mark at half past, UTC time.
    expect(secondsUntilReset(at, 'Asia/Kolkata')).toBe(12 * 60 + 7);
  });

  it('FE-DEMO-MODEL-005: falls back to the browser clock for a zone it does not know, or none', () => {
    const at = new Date(2026, 9, 24, 12, 59, 30);
    expect(secondsUntilReset(at, 'Not/AZone')).toBe(30);
    expect(secondsUntilReset(at)).toBe(30);
    expect(secondsUntilReset(new Date(2026, 9, 24, 13, 0, 0))).toBe(3600);
  });

  it('FE-DEMO-MODEL-006: formats the countdown as minutes and seconds', () => {
    expect(formatCountdown(42 * 60 + 7)).toBe('42:07');
    expect(formatCountdown(5)).toBe('00:05');
    expect(formatCountdown(3600)).toBe('60:00');
    expect(formatCountdown(-3)).toBe('00:00');
  });
});
