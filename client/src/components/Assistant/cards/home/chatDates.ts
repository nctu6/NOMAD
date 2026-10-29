/**
 * The days a card of another chat names under its head: one day, a span, or
 * that it has none yet. Pure, so the trip's card and the journal's read one
 * wording.
 */
export function chatDates(
  t: (key: string, params?: Record<string, string>) => string,
  date: (value: string) => string,
  startDate: string | null,
  endDate: string | null
): string {
  const start = startDate ?? endDate;
  const end = endDate ?? startDate;
  if (!start || !end) return t('assistant.card.tripChat.noDates');
  if (start === end) return date(start);
  return t('assistant.card.tripChat.dates', { start: date(start), end: date(end) });
}
