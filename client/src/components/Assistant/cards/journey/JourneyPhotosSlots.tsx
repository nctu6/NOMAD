import type { JourneyPhotosCard, JourneyPhotosEntry } from '@trek/shared';
import { ArrowRight, Images, MessageSquareText, Play } from 'lucide-react';

import { useTranslation } from '../../../../i18n';
import { cardDateLabel } from '../../../Journey/journeyCard';
import { SoftPill } from '../../../Planner/planParts';
import type { ChangeItem } from '../../assistantParts';
import { FactChange } from '../parts/CardFacts';

/**
 * What a change row of a journal's photos adds under the row: the entries
 * the photos leave and reach, the photos themselves as small thumbnails (the
 * first marked as the entry's cover in a new order), a caption old to new,
 * and what the change leaves where. A change that failed, was discarded or
 * ran out shows the row alone.
 */

const GONE: ReadonlySet<ChangeItem['state']> = new Set(['failed', 'discarded', 'expired']);
const NOTE = 'm-0 mt-1.5 text-caption text-content-muted';

function EntryName({ entry }: { entry: JourneyPhotosEntry }) {
  const { locale } = useTranslation();
  const day = entry.date ? cardDateLabel(entry.date, locale) : null;
  return <bdi className="min-w-0 truncate">{entry.title ?? day ?? ''}</bdi>;
}

/** The entries the photos leave and reach, the way between them marked. */
function Route({ card }: { card: JourneyPhotosCard }) {
  if (!card.from && !card.to) return null;
  return (
    <p className="m-0 flex min-w-0 items-center gap-1.5 text-caption text-content-secondary">
      {card.from && <EntryName entry={card.from} />}
      {card.from && card.to && (
        <ArrowRight size={11} aria-hidden="true" className="flex-none text-content-faint rtl:-scale-x-100" />
      )}
      {card.to && <EntryName entry={card.to} />}
    </p>
  );
}

function Thumbs({ card }: { card: JourneyPhotosCard }) {
  const { t } = useTranslation();
  if (card.photos.length === 0 && card.more === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {card.photos.map((photo, index) => (
        <span key={`${photo.photoId}-${index}`} className="relative size-11 flex-none">
          <img
            src={`/api/photos/${photo.photoId}/thumbnail`}
            alt={photo.caption ?? ''}
            loading="lazy"
            className="size-full rounded-lg bg-surface-secondary object-cover"
          />
          {photo.video && (
            <SoftPill className="absolute bottom-0.5 end-0.5" icon={<Play size={9} aria-hidden="true" />}>
              <span className="sr-only">{t('assistant.card.journey.video')}</span>
            </SoftPill>
          )}
          {card.mode === 'order' && index === 0 && (
            <span className="sr-only">{t('assistant.card.journeyPhotos.cover')}</span>
          )}
        </span>
      ))}
      {card.more > 0 && (
        <SoftPill icon={<Images size={10} strokeWidth={2.2} aria-hidden="true" />}>
          {t('assistant.card.common.more', { count: card.more })}
        </SoftPill>
      )}
    </div>
  );
}

/** What the change leaves where: on the first entry too, in the gallery, the first photo the cover. */
function Notes({ card }: { card: JourneyPhotosCard }) {
  const { t } = useTranslation();
  if (card.mode === 'move' && card.kept) return <p className={NOTE}>{t('assistant.card.journeyPhotos.kept')}</p>;
  if (card.mode === 'unlink' || card.mode === 'move') {
    return <p className={NOTE}>{t('assistant.card.journeyPhotos.staysInGallery')}</p>;
  }
  if (card.mode === 'order' && card.photos.length > 0) {
    return <p className={NOTE}>{t('assistant.card.journeyPhotos.firstIsCover')}</p>;
  }
  if (card.mode === 'add') return <p className={NOTE}>{t('assistant.card.journeyPhotos.fromLibrary')}</p>;
  return null;
}

export function JourneyPhotosBody({ card, item }: { card: JourneyPhotosCard; item: ChangeItem }) {
  const { t } = useTranslation();
  if (GONE.has(item.state)) return null;
  return (
    <div>
      <Route card={card} />
      <Thumbs card={card} />
      {card.caption && (
        <span className="mt-1.5 flex">
          <FactChange
            icon={MessageSquareText}
            before={card.caption.before}
            after={card.caption.after ?? t('assistant.card.common.removed')}
            tone="info"
          />
        </span>
      )}
      <Notes card={card} />
    </div>
  );
}
