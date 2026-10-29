import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import DemoLock from '../Demo/DemoLock';
import { useDemoAccountLock } from '../Demo/useDemoLock';

/**
 * The account cards under the demo lock, on the desktop tab and the phone
 * screen alike. Every visitor of a demo instance signs in as the one shared
 * demo account, so its profile, password, two factor setup and passkeys stay
 * on view but out of reach, while the admin of a demo instance and every
 * account of a real one get the cards as they are. Both views wrap their
 * cards in this, so whom the lock holds and the reason it gives are written
 * once.
 */
export default function AccountDemoLock({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const locked = useDemoAccountLock();
  return (
    <DemoLock locked={locked} reason={t('demo.lock.account')}>
      {children}
    </DemoLock>
  );
}
