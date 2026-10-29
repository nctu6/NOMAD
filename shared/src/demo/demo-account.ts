/**
 * The shared account every visitor of a demo instance signs in as.
 *
 * Both sides ask the same question: the server refuses the writes this
 * account may not make, and the client shows the same sections under a demo
 * lock. `demo@nomad.app` is the address the account had before the rename, so
 * an instance upgraded in place still treats it as the demo account.
 */
export const DEMO_ACCOUNT_EMAILS: readonly string[] = ['demo@trek.app', 'demo@nomad.app'];

/** Whether this address is the demo account's. Instance demo mode is asked apart. */
export function isDemoAccountEmail(email: string | null | undefined): boolean {
  return !!email && DEMO_ACCOUNT_EMAILS.includes(email);
}
