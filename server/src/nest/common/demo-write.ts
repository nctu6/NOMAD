import { readEnv } from '../../app-config';
import { RuntimeEnvService } from '../app-config/runtime-env.service';
import { DEMO_ACCOUNT_SETTINGS, isDemoEmail } from './demo';
import { DomainError } from './domain-error';

/** The exact 403 body the upload endpoints answer the demo account with. */
export const DEMO_WRITE_ERROR = {
  error: 'Uploads are disabled in demo mode. Self-host TREK for full functionality.',
} as const;

/**
 * Whether this user's writes are blocked because the instance runs in demo mode.
 *
 * The condition was copy-pasted into six upload handlers, each with its own copy
 * of the message. It lives here once now, and every one of them calls it, as do
 * the journey photo, video and cover uploads and the collab note file and chat
 * image uploads that came without it.
 *
 * Deliberately a function and not a guard, though every site is a handler and
 * a guard is the obvious shape. Guards run before the multipart parser, so
 * throwing from one leaves the request body unread and Node resets the
 * connection: the client sees ECONNRESET instead of the 403. PROFILE-015 catches
 * exactly that. Checking inside the handler, after the interceptor has drained
 * the upload, is what makes the response arrive.
 */
export function isDemoWriteBlocked(env: RuntimeEnvService, email: string | null | undefined): boolean {
  return env.isDemoMode() && isDemoEmail(email);
}

// The user-id flavour of the demo guard — the *.mcp.ts demo guards that used
// to call `isDemoUserId(env, db, userId)` here now inject `DemoService`
// (`common/demo.service.ts`, Plan 3i Task 3) and call
// `this.demo.isDemoUserId(userId)` instead: the same check, resolving `env`/
// the repository via its own constructor rather than taking them as
// parameters.

/**
 * The shared account every visitor of a demo instance signs in as. The same
 * reading of the environment as the password, MFA and session refusals in
 * `auth/`, so a controller that has no RuntimeEnvService of its own (passkeys,
 * OAuth) asks the same question without a new constructor parameter.
 */
export function isDemoAccount(user: { email?: string | null } | null | undefined): boolean {
  return readEnv().demo.enabled && isDemoEmail(user?.email);
}

/**
 * What the demo account is told when it tries to change something every other
 * visitor shares. One sentence per area, so the client can show it as it is.
 */
export const DEMO_ACCOUNT_REFUSAL = {
  apiKeys: 'API keys cannot be created in demo mode.',
  mcp: 'MCP clients cannot be connected in demo mode.',
  account: 'The demo account cannot be changed in demo mode.',
  passkeys: 'Passkeys cannot be changed in demo mode.',
} as const;

/** Refuses the write with a 403 for the demo account; does nothing for anybody else. */
export function refuseForDemoAccount(user: { email?: string | null } | null | undefined, message: string): void {
  if (isDemoAccount(user)) throw new DomainError(403, message);
}

/**
 * Whether a settings write of this key is one the demo account does not get to
 * make (`DEMO_ACCOUNT_SETTINGS`). The route answers as if it saved nothing,
 * rather than refusing: a client that sends the language along with other keys
 * keeps the rest of its save.
 */
export function isDemoLockedSetting(user: { email?: string | null } | null | undefined, key: string): boolean {
  return Object.hasOwn(DEMO_ACCOUNT_SETTINGS, key) && isDemoAccount(user);
}

/** The settings of a bulk save without the keys the demo account keeps fixed. */
export function withoutDemoLockedSettings(
  user: { email?: string | null } | null | undefined,
  settings: Record<string, unknown>,
): Record<string, unknown> {
  if (!isDemoAccount(user)) return settings;
  return Object.fromEntries(Object.entries(settings).filter(([key]) => !Object.hasOwn(DEMO_ACCOUNT_SETTINGS, key)));
}
