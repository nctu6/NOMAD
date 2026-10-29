import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { fs } from '../shared/DialogShell';

interface DemoLockProps {
  /** From useDemoAccountLock: false renders the children untouched. */
  locked: boolean;
  /** One line saying what the demo does not allow here. */
  reason: string;
  children: ReactNode;
  /** `row` for a single settings row: the note sits in the middle instead of at the top. */
  size?: 'section' | 'row';
  className?: string;
}

/** Thin diagonal stripes in the theme's own ink, so they read in light and dark alike. */
const STRIPES =
  'repeating-linear-gradient(135deg, color-mix(in srgb, var(--text-primary) 8%, transparent) 0 9px, transparent 9px 18px)';

/**
 * A section the shared demo account may look at but not change: dimmed,
 * out of reach for pointer and keyboard, under a striped veil that carries a
 * small "Demo mode" badge and the reason. Used on the desktop settings and on
 * the phone screens alike.
 */
export default function DemoLock({ locked, reason, children, size = 'section', className = '' }: DemoLockProps) {
  const { t } = useTranslation();
  if (!locked) return <>{children}</>;
  return (
    <div className={`relative ${className}`} data-demo-lock="">
      <div inert aria-hidden="true" className="pointer-events-none select-none opacity-40 saturate-50">
        {children}
      </div>
      <div
        role="note"
        className={`absolute inset-0 flex justify-center rounded-2xl border border-dashed border-edge-secondary ${
          size === 'row' ? 'items-center p-1' : 'items-start p-3'
        }`}
        style={{ background: STRIPES }}
      >
        <div className="sticky top-3 flex max-w-full flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-2xl bg-surface-card px-3 py-2 text-center shadow-md ring-1 ring-edge-faint">
          <span
            className="inline-flex flex-none items-center gap-1 rounded-full bg-accent px-2 py-0.5 font-semibold uppercase tracking-[.06em] text-accent-text"
            style={fs(10)}
          >
            <Lock size={11} strokeWidth={2.4} aria-hidden />
            {t('demo.lock.badge')}
          </span>
          <span className="min-w-0 text-content-secondary" style={fs(12.5, 'body')}>
            {reason}
          </span>
        </div>
      </div>
    </div>
  );
}
