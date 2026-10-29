import type { TripChatCard, TripChatPhase } from '@trek/shared';
import { Luggage } from 'lucide-react';

import { useTranslation } from '../../../../i18n';
import { type PillTone, SoftPill, WhiteBadge } from '../../../Planner/planParts';
import type { CardEntry } from '../cardTypes';
import CardFrame from '../parts/CardFrame';
import CardHeader from '../parts/CardHeader';
import { useCardFormat } from '../parts/useCardFormat';
import { chatDates } from './chatDates';
import { HandedQuestion, OpenChatButton } from './ChatHandOver';

/**
 * The home chat's way into one trip's own chat: the trip under its head (its
 * dates, where it stands, how many places it holds), the question that waits
 * there ready to send, and the button that goes on in that chat. The button
 * shows only where a chat can be switched to; the window switches in place,
 * the phone opens the trip with its chat.
 */

/** Where the trip stands, as a pill; a trip without dates says so on its line instead. */
const PHASE: Readonly<Record<Exclude<TripChatPhase, 'undated'>, { labelKey: string; tone: PillTone }>> = {
  now: { labelKey: 'assistant.card.tripChat.phase.now', tone: 'success' },
  next: { labelKey: 'assistant.card.tripChat.phase.next', tone: 'accent' },
  upcoming: { labelKey: 'assistant.card.tripChat.phase.upcoming', tone: 'info' },
  past: { labelKey: 'assistant.card.tripChat.phase.past', tone: 'neutral' },
};

function TripChatSection({ card, first }: { card: TripChatCard; first: boolean }) {
  const { t } = useTranslation();
  const format = useCardFormat();
  const { trip, question } = card;
  const dates = chatDates(t, format.date, trip.startDate, trip.endDate);
  const phase = trip.phase === 'undated' ? null : PHASE[trip.phase];
  return (
    <div className={first ? '' : 'mt-3 border-t border-edge-faint pt-3'}>
      {first ? (
        <CardHeader
          icon={Luggage}
          tone="info"
          eyebrow={t('assistant.card.tripChat.eyebrow')}
          title={trip.title}
          meta={dates}
        >
          <TripFacts phase={phase} placeCount={trip.placeCount} />
        </CardHeader>
      ) : (
        <div className="mb-2.5">
          <bdi className="block truncate text-body font-bold text-content">{trip.title}</bdi>
          <div className="mt-0.5 text-caption text-content-muted">{dates}</div>
          <TripFacts phase={phase} placeCount={trip.placeCount} />
        </div>
      )}
      <HandedQuestion question={question} />
      <OpenChatButton
        chat={{ id: trip.id, title: trip.title }}
        question={question}
        label={t('assistant.card.tripChat.open')}
      />
    </div>
  );
}

/** The pills under the trip's name: where it stands and how many places it holds. */
function TripFacts({
  phase,
  placeCount,
}: {
  phase: { labelKey: string; tone: PillTone } | null;
  placeCount: number | null;
}) {
  const { t } = useTranslation();
  if (!phase && !placeCount) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {phase && <SoftPill tone={phase.tone}>{t(phase.labelKey)}</SoftPill>}
      {!!placeCount && <WhiteBadge>{t('collections.placeCount', { count: placeCount })}</WhiteBadge>}
    </div>
  );
}

export function TripChatBlock({ cards }: { cards: readonly CardEntry[] }) {
  const { t } = useTranslation();
  const trips = cards.flatMap((entry) => (entry.card.kind === 'tripChat' ? [entry.card] : []));
  if (trips.length === 0) return null;
  return (
    <CardFrame label={t('assistant.card.tripChat.label')}>
      {trips.map((card, index) => (
        <TripChatSection key={`${card.trip.id}-${index}`} card={card} first={index === 0} />
      ))}
    </CardFrame>
  );
}
