import type { AssistantChangeRow, JourneyHeaderCard, JourneyHeaderTrip } from '@trek/shared';
import { AlignLeft, Luggage, Type } from 'lucide-react';

import { useTranslation } from '../../../../i18n';
import { type PillTone, SoftPill } from '../../../Planner/planParts';
import type { ChangeItem } from '../../assistantParts';
import { FactChange } from '../parts/CardFacts';
import { useCardFormat } from '../parts/useCardFormat';
import { headerFieldOf, headerValueKey, settingRows } from './journeyHeaderModel';

/**
 * What a change row of a journal itself adds to the row it already is (its
 * verb and the journal's name): on the faint line the name, subtitle and
 * settings it changes, each old to new; under the row the journal's trips,
 * the one the change links or unlinks marked, and what the change brings or
 * takes along. A change that failed, was discarded or ran out shows the row
 * alone.
 */

const GONE: ReadonlySet<ChangeItem['state']> = new Set(['failed', 'discarded', 'expired']);
const WORD_ICONS = { name: Type, description: AlignLeft } as const;
const NOTE = 'm-0 mt-1.5 text-caption';

const TRIP_TONE: Readonly<Record<JourneyHeaderTrip['change'], PillTone>> = {
  kept: 'neutral',
  link: 'success',
  unlink: 'danger',
};

/** One setting a change sets, by its name, old to new. */
function SettingChange({ row }: { row: AssistantChangeRow }) {
  const { t } = useTranslation();
  const look = headerFieldOf(row.field);
  if (!look) return null;
  const named = (value: string | null) => {
    const key = headerValueKey(row.field, value);
    if (key) return t(key);
    return value || null;
  };
  const before = row.op === 'add' ? null : named(row.before);
  const after = named(row.after) ?? t('assistant.card.common.removed');
  const name = t(look.labelKey);
  return (
    <FactChange
      icon={look.Icon}
      before={before === null ? null : t('assistant.card.journeyHeader.setting', { name, value: before })}
      after={t('assistant.card.journeyHeader.setting', { name, value: after })}
      tone="info"
    />
  );
}

/** The journal's new name and subtitle and the settings a change sets. */
export function JourneyHeaderFacts({ item }: { card: JourneyHeaderCard; item: ChangeItem }) {
  const { t } = useTranslation();
  const rows = item.preview?.rows ?? [];
  const words = rows.filter(
    (row): row is AssistantChangeRow & { labelKey: keyof typeof WORD_ICONS } =>
      row.op === 'change' && row.labelKey in WORD_ICONS
  );
  return (
    <>
      {words.map((row) => (
        <FactChange
          key={row.labelKey}
          icon={WORD_ICONS[row.labelKey]}
          before={row.before || null}
          after={row.after || t('assistant.card.common.removed')}
          tone="info"
        />
      ))}
      {settingRows(rows).map((row) => (
        <SettingChange key={row.field} row={row} />
      ))}
    </>
  );
}

function TripChip({ trip }: { trip: JourneyHeaderTrip }) {
  const { t } = useTranslation();
  const format = useCardFormat();
  const days = trip.startDate ? format.date(trip.startDate) : null;
  return (
    <SoftPill
      tone={TRIP_TONE[trip.change]}
      className="max-w-full"
      icon={<Luggage size={10} strokeWidth={2.2} aria-hidden="true" className="flex-none" />}
    >
      {trip.change === 'link' && <span className="sr-only">{t('assistant.card.journeyHeader.tripLink')}</span>}
      {trip.change === 'unlink' && <span className="sr-only">{t('assistant.card.journeyHeader.tripUnlink')}</span>}
      <bdi className={`truncate ${trip.change === 'unlink' ? 'line-through' : ''}`}>{trip.title}</bdi>
      {days && <span className="text-content-faint">{days}</span>}
    </SoftPill>
  );
}

/** What the change brings along or takes with it, in the journal's words. */
function HeaderNotes({ card }: { card: JourneyHeaderCard }) {
  const { t } = useTranslation();
  const unlinking = card.trips.some((trip) => trip.change === 'unlink');
  if (card.change === 'willDelete') {
    return <p className={`${NOTE} text-danger`}>{t('assistant.card.journeyHeader.deletes')}</p>;
  }
  if (unlinking) {
    return (
      <>
        {card.entries !== null && card.entries > 0 && (
          <p className={`${NOTE} text-content-muted`}>
            {t('assistant.card.journeyHeader.entriesStay', { count: card.entries })}
          </p>
        )}
        {card.suggestions !== null && card.suggestions > 0 && (
          <p className={`${NOTE} text-content-muted`}>
            {t('assistant.card.journeyHeader.suggestionsGo', { count: card.suggestions })}
          </p>
        )}
      </>
    );
  }
  if (card.suggestions === null || card.suggestions === 0) return null;
  return (
    <p className={`${NOTE} text-content-muted`}>
      {t('assistant.card.journeyHeader.suggestionsCome', { count: card.suggestions })}
    </p>
  );
}

/** The journal's trips and what the change brings or takes, under the row. */
export function JourneyHeaderBody({ card, item }: { card: JourneyHeaderCard; item: ChangeItem }) {
  if (GONE.has(item.state)) return null;
  return (
    <div>
      {card.subtitle && card.change === 'new' && (
        <p className="m-0 text-caption text-content-muted">
          <bdi>{card.subtitle}</bdi>
        </p>
      )}
      {card.trips.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {card.trips.map((trip, index) => (
            <TripChip key={`${trip.id ?? 'x'}-${index}`} trip={trip} />
          ))}
        </div>
      )}
      <HeaderNotes card={card} />
    </div>
  );
}
