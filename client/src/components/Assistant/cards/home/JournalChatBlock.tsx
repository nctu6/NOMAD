import type { JournalChatCard } from '@trek/shared';
import { BookOpen } from 'lucide-react';

import { useTranslation } from '../../../../i18n';
import { assistantChatKey } from '../../../../store/assistantChatKey';
import { WhiteBadge } from '../../../Planner/planParts';
import type { CardEntry } from '../cardTypes';
import CardFrame from '../parts/CardFrame';
import CardHeader from '../parts/CardHeader';
import { useCardFormat } from '../parts/useCardFormat';
import { chatDates } from './chatDates';
import { HandedQuestion, OpenChatButton } from './ChatHandOver';

/**
 * The home chat's way onto a journal's own page: the journal under its head
 * (its subtitle or days, how many entries and photos it holds), the question
 * that waits there ready to send, and the button that goes on in the
 * journal's chat. That chat is the journey's conversation on its page, kept
 * under the journey's key; the window switches to it in place, the phone
 * opens the journal with its chat.
 */

function JournalFacts({ card }: { card: JournalChatCard }) {
  const { t } = useTranslation();
  const { entryCount, photoCount } = card.journey;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <WhiteBadge>{t('assistant.card.journey.entries', { count: entryCount })}</WhiteBadge>
      {photoCount > 0 && <WhiteBadge>{t('assistant.card.journey.photos', { count: photoCount })}</WhiteBadge>}
    </div>
  );
}

function JournalChatSection({ card, first }: { card: JournalChatCard; first: boolean }) {
  const { t } = useTranslation();
  const format = useCardFormat();
  const { journey, question } = card;
  const meta = journey.subtitle ?? chatDates(t, format.date, journey.startDate, journey.endDate);
  const chat = { id: assistantChatKey({ kind: 'journey', journeyId: journey.id }), title: journey.title };
  return (
    <div className={first ? '' : 'mt-3 border-t border-edge-faint pt-3'}>
      {first ? (
        <CardHeader
          icon={BookOpen}
          tone="info"
          eyebrow={t('assistant.card.journalChat.eyebrow')}
          title={journey.title}
          meta={meta}
        >
          <JournalFacts card={card} />
        </CardHeader>
      ) : (
        <div className="mb-2.5">
          <bdi className="block truncate text-body font-bold text-content">{journey.title}</bdi>
          <div className="mt-0.5 text-caption text-content-muted">{meta}</div>
          <JournalFacts card={card} />
        </div>
      )}
      <HandedQuestion question={question} />
      <OpenChatButton chat={chat} question={question} label={t('assistant.card.journalChat.open')} />
    </div>
  );
}

export function JournalChatBlock({ cards }: { cards: readonly CardEntry[] }) {
  const { t } = useTranslation();
  const journals = cards.flatMap((entry) => (entry.card.kind === 'journalChat' ? [entry.card] : []));
  if (journals.length === 0) return null;
  return (
    <CardFrame label={t('assistant.card.journalChat.label')}>
      {journals.map((card, index) => (
        <JournalChatSection key={`${card.journey.id}-${index}`} card={card} first={index === 0} />
      ))}
    </CardFrame>
  );
}
