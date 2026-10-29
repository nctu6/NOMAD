import { useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n';
import { fs } from '../shared/DialogShell';
import {
  PHOTO_CREDITS,
  PUBLIC_DOMAIN,
  commonsPage,
  creditTitle,
  licenseDeed,
  type PhotoCredit,
} from './demoCreditsModel';

type Translate = ReturnType<typeof useTranslation>['t'];

const LINK = 'underline decoration-edge underline-offset-2 hover:text-content';

/** One photo: its title linking to its page on Commons, who took it, and its license linking to the deed. */
function CreditRow({ credit, t }: { credit: PhotoCredit; t: Translate }) {
  const deed = licenseDeed(credit.license);
  const license = credit.license === PUBLIC_DOMAIN ? t('demo.credits.publicDomain') : credit.license;
  return (
    <li className="flex flex-col gap-0.5 py-2.5">
      <a
        href={commonsPage(credit.file)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${LINK} self-start break-words font-medium text-content`}
        style={fs(12.5, 'body')}
      >
        {creditTitle(credit.file)}
      </a>
      <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-content-muted" style={fs(12, 'body')}>
        <span>{t('demo.credits.by', { author: credit.author })}</span>
        {deed ? (
          <a href={deed} target="_blank" rel="noopener noreferrer" className={LINK}>
            {license}
          </a>
        ) : (
          <span>{license}</span>
        )}
      </span>
    </li>
  );
}

/**
 * The credits for the demo's photos, the welcome dialog's second view. Its own
 * chunk, loaded when a visitor opens it: only a demo instance shows the
 * welcome, and few visitors open its credits.
 */
export default function DemoCredits() {
  const { t } = useTranslation();
  const intro = useRef<HTMLParagraphElement>(null);

  // The dialog's body keeps the welcome's scroll position when the credits
  // take its place; they start at their top.
  useEffect(() => {
    intro.current?.scrollIntoView({ block: 'nearest' });
  }, []);

  return (
    <>
      <p ref={intro} className="m-0 scroll-mt-5 leading-snug text-content-secondary" style={fs(12.5, 'body')}>
        {t('demo.credits.intro')}
      </p>
      <ul
        aria-label={t('demo.credits.title')}
        className="m-0 list-none divide-y divide-edge-faint rounded-[16px] border border-edge-faint bg-surface-card px-3.5"
      >
        {PHOTO_CREDITS.map((credit) => (
          <CreditRow key={credit.file} credit={credit} t={t} />
        ))}
      </ul>
    </>
  );
}
