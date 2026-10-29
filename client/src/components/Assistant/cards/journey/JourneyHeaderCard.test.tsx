/**
 * FE-AI-JOURNEYHEADER-001 to FE-AI-JOURNEYHEADER-005
 *
 * A change of a journal itself in the chat: the settings an update sets by
 * the journal's own names, old to new; the trips under the row with the one
 * the change links or unlinks marked; what a new journal brings and what a
 * deletion or an unlink takes; the receipt that opens the journal.
 */
import type { AssistantApplied, AssistantChangePreview, JourneyHeaderCard, JourneyHeaderTrip } from '@trek/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fireEvent, render, screen } from '../../../../../tests/helpers/render';
import { useAssistantStore } from '../../../../store/assistantStore';
import AssistantChangeCard from '../../AssistantChangeCard';
import type { ChangeItem } from '../../assistantParts';
import { AssistantViewContext } from '../../assistantViewContext';
import { headerValueKey, settingRows } from './journeyHeaderModel';

const ASSISTANT = useAssistantStore.getState();

afterEach(() => {
  useAssistantStore.setState(ASSISTANT, true);
});

const TOKYO: JourneyHeaderTrip = {
  id: 5,
  title: 'Tokyo days',
  startDate: '2026-11-02',
  endDate: '2026-11-08',
  change: 'kept',
};

const JAPAN: JourneyHeaderCard = {
  kind: 'journeyHeader',
  journeyId: 12,
  title: 'Japan 2026',
  subtitle: null,
  change: 'changed',
  trips: [TOKYO],
  entries: 3,
  photos: 40,
  suggestions: null,
};

function change(
  state: ChangeItem['state'],
  card: JourneyHeaderCard,
  over: Partial<AssistantChangePreview> = {}
): ChangeItem {
  const preview: AssistantChangePreview = {
    toolCallId: 'h1',
    verbKey: 'updateJournalSettings',
    subject: 'Japan 2026',
    rows: [],
    dayId: null,
    placeIds: [],
    undoable: true,
    domain: 'journey',
    card,
    ...over,
  };
  const applied: AssistantApplied = { toolCallId: 'h1', entity: 'journey', ids: [12], dayId: null, undoUntil: null };
  return { toolCallId: 'h1', preview, applied: state === 'applied' ? applied : null, state, card };
}

function shown(item: ChangeItem, onOpen?: (target: unknown) => void) {
  return render(
    <AssistantViewContext.Provider value={{ tripId: -12, variant: 'window', onOpen }}>
      <AssistantChangeCard items={[item]} />
    </AssistantViewContext.Provider>
  );
}

describe('a change of a journal itself', () => {
  it('FE-AI-JOURNEYHEADER-001: an update names each setting by the journal own words, old to new', () => {
    const rows: AssistantChangePreview['rows'] = [
      { op: 'change', labelKey: 'name', before: 'Japan', after: 'Japan 2026' },
      { op: 'change', labelKey: 'field', field: 'show_mood', before: '✓', after: '✗' },
      { op: 'change', labelKey: 'field', field: 'status_override', before: '', after: 'live' },
    ];
    shown(change('pending', JAPAN, { rows }));
    expect(screen.getByText("Change the journal's settings")).toBeInTheDocument();
    expect(screen.getByText('Japan')).toHaveClass('line-through');
    expect(screen.getByText('Mood: On')).toHaveClass('line-through');
    expect(screen.getByText('Mood: Off')).toBeInTheDocument();
    expect(screen.getByText('Shown as: Automatic')).toHaveClass('line-through');
    expect(screen.getByText('Shown as: Live')).toBeInTheDocument();
    expect(screen.getByText('Tokyo days')).toBeInTheDocument();
  });

  it('FE-AI-JOURNEYHEADER-002: a new journal shows its subtitle, the trips it links and the places that come in', () => {
    const fresh: JourneyHeaderCard = {
      ...JAPAN,
      journeyId: null,
      change: 'new',
      subtitle: 'Autumn',
      trips: [{ ...TOKYO, change: 'link' }],
      entries: null,
      photos: null,
      suggestions: 9,
    };
    shown(change('pending', fresh, { verbKey: 'createJournal', undoable: true }));
    expect(screen.getByText('Start a journal')).toBeInTheDocument();
    expect(screen.getByText('Autumn')).toBeInTheDocument();
    expect(screen.getByText('Will be added')).toBeInTheDocument();
    expect(screen.getByText('9 places come in as suggestions')).toBeInTheDocument();
  });

  it('FE-AI-JOURNEYHEADER-003: a deletion warns that everything goes; an unlink says what stays and what goes', () => {
    const first = shown(change('pending', { ...JAPAN, change: 'willDelete' }, { verbKey: 'deleteJournal' }));
    expect(screen.getByText('Delete the journal')).toBeInTheDocument();
    expect(screen.getByText(/This cannot be undone\./)).toBeInTheDocument();
    first.unmount();
    const unlink: JourneyHeaderCard = {
      ...JAPAN,
      trips: [{ ...TOKYO, change: 'unlink' }],
      entries: 1,
      suggestions: 4,
    };
    shown(change('pending', unlink, { verbKey: 'unlinkJournalTrip' }));
    expect(screen.getByText('Tokyo days')).toHaveClass('line-through');
    expect(screen.getByText('Will be taken out')).toBeInTheDocument();
    expect(screen.getByText('1 written entry stays')).toBeInTheDocument();
    expect(screen.getByText('4 open suggestions go')).toBeInTheDocument();
  });

  it('FE-AI-JOURNEYHEADER-004: the receipt opens the journal, a change that failed shows its row alone', () => {
    const onOpen = vi.fn();
    const applied = shown(change('applied', JAPAN), onOpen);
    fireEvent.click(screen.getByRole('button', { name: 'Open the journal' }));
    expect(onOpen).toHaveBeenCalledWith({ kind: 'page', path: '/journey/12' });
    applied.unmount();
    shown(change('failed', JAPAN));
    expect(screen.queryByText('Tokyo days')).toBeNull();
  });

  it('FE-AI-JOURNEYHEADER-005: the model reads a status by its name and a switch as on or off', () => {
    expect(headerValueKey('status', 'archived')).toBe('journey.status.archived');
    expect(headerValueKey('status_override', null)).toBe('journey.settings.statusAuto');
    expect(headerValueKey('show_mood', '✓')).toBe('settings.on');
    expect(headerValueKey('cover_gradient', 'linear-gradient(red, blue)')).toBeNull();
    expect(headerValueKey('status', 'toString')).toBeNull();
    const rows: AssistantChangePreview['rows'] = [
      { op: 'add', labelKey: 'field', field: 'trip', before: null, after: 'Kyoto' },
      { op: 'add', labelKey: 'field', field: 'show_weather', before: null, after: '✓' },
      { op: 'add', labelKey: 'field', field: 'unknown', before: null, after: 'x' },
      { op: 'change', labelKey: 'name', before: 'A', after: 'B' },
    ];
    expect(settingRows(rows).map((row) => row.field)).toEqual(['show_weather']);
  });
});
