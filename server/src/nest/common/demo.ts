import { DEMO_ACCOUNT_EMAILS } from '@trek/shared';

// Central registry of demo-user email addresses.
//
// Historical: the demo account was seeded as "demo@trek.app" (see
// authService.demoLogin), but several guards — demoUploadBlock in
// the upload block that used to live in middleware/auth.ts, the MFA/backup-code
// bypasses in authService —
// were still checking the pre-rename "demo@nomad.app" string, so they
// either never fired or silently diverged between call sites. Routing
// every check through this constant keeps them aligned.

export const DEMO_EMAIL_PRIMARY = 'demo@trek.app';

/**
 * The demo account's password. Public on purpose — a demo instance shows it on
 * the login screen so visitors can get in — but it was written out twice, in the
 * seeder and in the config payload, which is one copy too many for something the
 * seeder has to match exactly for the login to work.
 */
export const DEMO_PASS = 'demo12345';

/**
 * All email addresses that should be treated as the demo account.
 * Includes the historical `demo@nomad.app` identifier so instances that
 * upgraded in place without resetting the DB still hit demo-mode guards.
 */
export const DEMO_EMAILS: ReadonlySet<string> = new Set(DEMO_ACCOUNT_EMAILS);

export function isDemoEmail(email: string | null | undefined): boolean {
  return !!email && DEMO_EMAILS.has(email);
}

/**
 * User settings the shared demo account always holds, whatever a visitor picks.
 * The demo seed writes them on every boot and after every hourly reset, and the
 * settings routes leave them alone for the demo account (`demo-write.ts`), so a
 * visitor cannot switch the demo every other visitor sees into another
 * language.
 */
export const DEMO_ACCOUNT_SETTINGS: Readonly<Record<string, string>> = { language: 'en' };
