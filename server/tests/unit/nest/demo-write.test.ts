/**
 * The demo-mode upload block.
 *
 * The condition was copy-pasted into six upload handlers, each carrying its own
 * copy of the 403 body. All six call isDemoWriteBlocked now.
 *
 * It is a function rather than a guard on purpose, and that is worth a test of
 * its own: guards run before the multipart parser, so throwing from one leaves
 * the request body unread and Node resets the connection — the client gets
 * ECONNRESET instead of the 403. PROFILE-015 in the integration suite is what
 * demonstrates it end-to-end.
 */
import { RuntimeEnvService } from '../../../src/nest/app-config/runtime-env.service';
import { isDemoEmail } from '../../../src/nest/common/demo';
import {
  DEMO_ACCOUNT_REFUSAL,
  DEMO_WRITE_ERROR,
  isDemoAccount,
  isDemoLockedSetting,
  isDemoWriteBlocked,
  refuseForDemoAccount,
  withoutDemoLockedSettings,
} from '../../../src/nest/common/demo-write';
import { DomainError } from '../../../src/nest/common/domain-error';

import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../../src/nest/common/demo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/nest/common/demo')>()),
  isDemoEmail: vi.fn(() => false),
}));

const env = new RuntimeEnvService();

afterEach(() => {
  delete process.env.DEMO_MODE;
  vi.mocked(isDemoEmail).mockReturnValue(false);
});

describe('isDemoWriteBlocked', () => {
  it('DEMO-WRITE-001: blocks the demo account while the instance runs in demo mode', () => {
    process.env.DEMO_MODE = 'true';
    vi.mocked(isDemoEmail).mockReturnValue(true);

    expect(isDemoWriteBlocked(env, 'demo@trek.app')).toBe(true);
  });

  it('DEMO-WRITE-002: lets a normal account through even while demo mode is on', () => {
    process.env.DEMO_MODE = 'true';
    vi.mocked(isDemoEmail).mockReturnValue(false);

    expect(isDemoWriteBlocked(env, 'alice@example.com')).toBe(false);
  });

  it('DEMO-WRITE-003: lets the demo account through when the instance is not in demo mode', () => {
    vi.mocked(isDemoEmail).mockReturnValue(true);

    expect(isDemoWriteBlocked(env, 'demo@trek.app')).toBe(false);
  });

  it('DEMO-WRITE-004: reads the env live, so a toggle takes effect without a restart', () => {
    vi.mocked(isDemoEmail).mockReturnValue(true);
    expect(isDemoWriteBlocked(env, 'demo@trek.app')).toBe(false);

    process.env.DEMO_MODE = 'true';
    expect(isDemoWriteBlocked(env, 'demo@trek.app')).toBe(true);
  });

  it('DEMO-WRITE-005: the 403 body is the one the six endpoints have always sent', () => {
    expect(DEMO_WRITE_ERROR).toEqual({
      error: 'Uploads are disabled in demo mode. Self-host TREK for full functionality.',
    });
  });
});

describe('the demo account locks', () => {
  const demo = { email: 'demo@trek.app' };
  const other = { email: 'alice@example.com' };
  const onDemoInstance = () => {
    process.env.DEMO_MODE = 'true';
    vi.mocked(isDemoEmail).mockImplementation((email) => email === 'demo@trek.app');
  };

  it('DEMO-WRITE-006: isDemoAccount is the demo address on a demo instance, and nothing else', () => {
    vi.mocked(isDemoEmail).mockImplementation((email) => email === 'demo@trek.app');
    expect(isDemoAccount(demo)).toBe(false);
    onDemoInstance();
    expect(isDemoAccount(demo)).toBe(true);
    expect(isDemoAccount(other)).toBe(false);
    expect(isDemoAccount(null)).toBe(false);
  });

  it('DEMO-WRITE-007: refuseForDemoAccount throws a 403 with the message for the demo account only', () => {
    onDemoInstance();
    expect(() => refuseForDemoAccount(other, DEMO_ACCOUNT_REFUSAL.apiKeys)).not.toThrow();
    let thrown: unknown;
    try {
      refuseForDemoAccount(demo, DEMO_ACCOUNT_REFUSAL.apiKeys);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(DomainError);
    expect((thrown as DomainError).getStatus()).toBe(403);
    expect((thrown as DomainError).getResponse()).toEqual({ error: 'API keys cannot be created in demo mode.' });
  });

  it('DEMO-WRITE-008: the language is the setting the demo account keeps', () => {
    onDemoInstance();
    expect(isDemoLockedSetting(demo, 'language')).toBe(true);
    expect(isDemoLockedSetting(demo, 'temperature_unit')).toBe(false);
    expect(isDemoLockedSetting(other, 'language')).toBe(false);
  });

  it('DEMO-WRITE-009: a bulk save of the demo account loses the language and keeps the rest', () => {
    const settings = { language: 'de', distance_unit: 'imperial' };
    expect(withoutDemoLockedSettings(demo, settings)).toBe(settings);
    onDemoInstance();
    expect(withoutDemoLockedSettings(demo, settings)).toEqual({ distance_unit: 'imperial' });
    expect(withoutDemoLockedSettings(other, settings)).toBe(settings);
  });
});
