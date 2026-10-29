import type { LucideIcon } from 'lucide-react';
import {
  BookImage,
  Bookmark,
  Bot,
  CalendarDays,
  DatabaseBackup,
  Globe,
  KeyRound,
  LayoutDashboard,
  Map as MapIcon,
  Mountain,
  NotebookPen,
  Puzzle,
  ShieldCheck,
  Sparkles,
  Terminal,
  Upload,
  UserLock,
  Users,
  WifiOff,
} from 'lucide-react';

/** One thing a visitor can try in the demo right away: a tile of the welcome dialog. */
interface DemoFeature {
  id: string;
  icon: LucideIcon;
  titleKey: string;
  bodyKey: string;
}

/** A line of the two lists under the tiles: what the demo leaves out, and what the full version adds. */
export interface DemoLine {
  icon: LucideIcon;
  labelKey: string;
}

export const DEMO_FEATURES: readonly DemoFeature[] = [
  { id: 'planner', icon: MapIcon, titleKey: 'demo.feature.planner.title', bodyKey: 'demo.feature.planner.body' },
  { id: 'tours', icon: Mountain, titleKey: 'demo.feature.tours.title', bodyKey: 'demo.feature.tours.body' },
  { id: 'studio', icon: BookImage, titleKey: 'demo.feature.studio.title', bodyKey: 'demo.feature.studio.body' },
  { id: 'collab', icon: Users, titleKey: 'demo.feature.collab.title', bodyKey: 'demo.feature.collab.body' },
  { id: 'journey', icon: NotebookPen, titleKey: 'demo.feature.journey.title', bodyKey: 'demo.feature.journey.body' },
  { id: 'atlas', icon: Globe, titleKey: 'demo.feature.atlas.title', bodyKey: 'demo.feature.atlas.body' },
  { id: 'vacay', icon: CalendarDays, titleKey: 'demo.feature.vacay.title', bodyKey: 'demo.feature.vacay.body' },
  {
    id: 'collections',
    icon: Bookmark,
    titleKey: 'demo.feature.collections.title',
    bodyKey: 'demo.feature.collections.body',
  },
  { id: 'offline', icon: WifiOff, titleKey: 'demo.feature.offline.title', bodyKey: 'demo.feature.offline.body' },
];

/** What the shared demo account cannot do; the server refuses each of them too. */
export const DEMO_LIMITS: readonly DemoLine[] = [
  { icon: Upload, labelKey: 'demo.limit.uploads' },
  { icon: UserLock, labelKey: 'demo.limit.account' },
  { icon: KeyRound, labelKey: 'demo.limit.apiKeys' },
  { icon: Terminal, labelKey: 'demo.limit.mcp' },
  { icon: Sparkles, labelKey: 'demo.limit.ai' },
];

export const DEMO_FULL_VERSION: readonly DemoLine[] = [
  { icon: ShieldCheck, labelKey: 'demo.full.sso' },
  { icon: DatabaseBackup, labelKey: 'demo.full.backups' },
  { icon: Puzzle, labelKey: 'demo.full.plugins' },
  { icon: Bot, labelKey: 'demo.full.assistant' },
  { icon: LayoutDashboard, labelKey: 'demo.full.admin' },
];

export const TREK_REPO_URL = 'https://github.com/liketrek/TREK';

/** The demo resets on the hour (the server's `0 * * * *` cron). */
const HOUR_SECONDS = 3600;

/**
 * Minute and second of the hour at `now` in the server's time zone, where the
 * reset cron runs. A zone whose offset is not whole hours (India, Nepal) moves
 * the hour mark; an unknown zone falls back to the browser's clock.
 */
function minuteAndSecond(now: Date, timeZone: string | undefined): [number, number] {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone, minute: 'numeric', second: 'numeric' }).formatToParts(
        now
      );
      const read = (type: 'minute' | 'second') => Number(parts.find((p) => p.type === type)?.value);
      const minute = read('minute');
      const second = read('second');
      if (Number.isFinite(minute) && Number.isFinite(second)) return [minute, second];
    } catch {
      // A zone this browser does not know: the local clock below.
    }
  }
  return [now.getMinutes(), now.getSeconds()];
}

/** Seconds until the next hourly reset, from 1 up to 3600. */
export function secondsUntilReset(now: Date, timeZone?: string): number {
  const [minute, second] = minuteAndSecond(now, timeZone);
  return HOUR_SECONDS - (minute * 60 + second);
}

/** The countdown as minutes and seconds, `42:07`. */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}
