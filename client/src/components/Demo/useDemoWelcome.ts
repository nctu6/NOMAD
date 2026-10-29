import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { formatCountdown, secondsUntilReset } from './demoWelcomeModel';

/**
 * Whether the photo credits have the dialog: not yet, now, or no longer
 * (the visitor came back from them, and the focus returns to their link).
 */
type CreditsView = 'unseen' | 'open' | 'left';

/**
 * The welcome dialog's state: whether it is still open, whether it shows the
 * photo credits in place of the welcome, and the live countdown to the next
 * hourly reset, ticking once a second in the server's time zone.
 */
export function useDemoWelcome() {
  const timeZone = useAuthStore((s) => s.serverTimezone);
  const [open, setOpen] = useState(true);
  const [credits, setCredits] = useState<CreditsView>('unseen');
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntilReset(new Date(), timeZone));

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setSecondsLeft(secondsUntilReset(new Date(), timeZone)), 1000);
    return () => clearInterval(timer);
  }, [open, timeZone]);

  return {
    open,
    close: () => setOpen(false),
    countdown: formatCountdown(secondsLeft),
    creditsOpen: credits === 'open',
    backFromCredits: credits === 'left',
    openCredits: () => setCredits('open'),
    closeCredits: () => setCredits('left'),
  };
}
