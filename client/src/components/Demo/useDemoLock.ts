import { isDemoAccountEmail } from '@trek/shared';
import { useAuthStore } from '../../store/authStore';

/**
 * Whether the account signed in here is the shared demo account of a demo
 * instance. Every visitor signs in as that one account, so its Account tab,
 * API keys, MCP configuration, own AI connection and language sit under a
 * DemoLock; the server refuses the same writes (`demo-write.ts`). The admin
 * of a demo instance, and every account of a real one, see the sections as
 * they are.
 */
export function useDemoAccountLock(): boolean {
  const demoMode = useAuthStore((s) => s.demoMode);
  const email = useAuthStore((s) => s.user?.email);
  return demoMode && isDemoAccountEmail(email);
}
