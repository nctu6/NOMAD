/**
 * FE-AI-JOURNEYPHOTOS-001 to FE-AI-JOURNEYPHOTOS-004
 *
 * A change of a journal's photos in the chat: the entries the photos leave
 * and reach, the photos as thumbnails, a caption old to new, what stays
 * where, and the receipt that opens the entry.
 */
import type { AssistantApplied, AssistantChangePreview, JourneyPhotosCard } from '@trek/shared';
import { describe, expect, it, vi } from 'vitest';

import { fireEvent, render, screen } from '../../../../../tests/helpers/render';
import AssistantChangeCard from '../../AssistantChangeCard';
import type { ChangeItem } from '../../assistantParts';
import { AssistantViewContext } from '../../assistantViewContext';

const MOVE: JourneyPhotosCard = {
  kind: 'journeyPhotos',
  journeyId: 3,
  mode: 'move',
  from: { entryId: 1, title: 'Vik', date: '2026-07-01' },
  to: { entryId: 2, title: 'Reynisfjara', date: '2026-07-02' },
  photos: [
    { photoId: 101, video: false, caption: 'Black sand' },
    { photoId: 102, video: true, caption: null },
  ],
  more: 4,
  kept: false,
  caption: null,
};

function photoChange(card: JourneyPhotosCard, verbKey: AssistantChangePreview['verbKey'], applied = false): ChangeItem {
  const preview: AssistantChangePreview = {
    toolCallId: 'p1',
    verbKey,
    subject: 'Reynisfjara',
    rows: [],
    dayId: null,
    placeIds: [],
    undoable: false,
    domain: 'journey',
    card,
  };
  const receipt: AssistantApplied = {
    toolCallId: 'p1',
    entity: 'journey_entry',
    ids: [2],
    dayId: null,
    undoUntil: null,
  };
  return { toolCallId: 'p1', preview, applied: applied ? receipt : null, state: applied ? 'applied' : 'pending', card };
}

function draw(item: ChangeItem, onOpen?: (target: unknown) => void) {
  return render(
    <AssistantViewContext.Provider value={{ tripId: -3, variant: 'window', onOpen }}>
      <AssistantChangeCard items={[item]} />
    </AssistantViewContext.Provider>
  );
}

describe('a change of a journal photos', () => {
  it('FE-AI-JOURNEYPHOTOS-001: a move names both entries, shows the photos and says they stay in the gallery', () => {
    const { container } = draw(photoChange(MOVE, 'moveJournalPhotos'));
    expect(screen.getByText('Move photos to another entry')).toBeInTheDocument();
    expect(screen.getByText('Vik')).toBeInTheDocument();
    expect(screen.getAllByText('Reynisfjara').length).toBeGreaterThan(0);
    const thumbs = [...container.querySelectorAll('img')].map((img) => img.getAttribute('src'));
    expect(thumbs).toEqual(['/api/photos/101/thumbnail', '/api/photos/102/thumbnail']);
    expect(screen.getByText('4 more')).toBeInTheDocument();
    expect(screen.getByText("The photos stay in the journal's gallery.")).toBeInTheDocument();
  });

  it('FE-AI-JOURNEYPHOTOS-002: a kept move and a new order say what stays where', () => {
    const first = draw(photoChange({ ...MOVE, kept: true }, 'moveJournalPhotos'));
    expect(screen.getByText('They also stay on the first entry.')).toBeInTheDocument();
    first.unmount();
    draw(photoChange({ ...MOVE, mode: 'order', from: null, more: 0 }, 'orderJournalPhotos'));
    expect(screen.getByText("The first photo becomes the entry's cover.")).toBeInTheDocument();
    expect(screen.getByText('Entry cover')).toBeInTheDocument();
  });

  it('FE-AI-JOURNEYPHOTOS-003: a caption reads old to new, a cleared one as removed', () => {
    const caption = {
      ...MOVE,
      mode: 'caption' as const,
      from: null,
      to: null,
      more: 0,
      photos: [{ photoId: 101, video: false, caption: 'Old' }],
    };
    const first = draw(photoChange({ ...caption, caption: { before: 'Old', after: 'New' } }, 'captionJournalPhoto'));
    expect(screen.getByText('Old')).toHaveClass('line-through');
    expect(screen.getByText('New')).toBeInTheDocument();
    first.unmount();
    draw(photoChange({ ...caption, caption: { before: 'Old', after: null } }, 'captionJournalPhoto'));
    expect(screen.getByText('Removed')).toBeInTheDocument();
  });

  it('FE-AI-JOURNEYPHOTOS-004: the receipt opens the entry on the journal page', () => {
    const onOpen = vi.fn();
    draw(photoChange(MOVE, 'moveJournalPhotos', true), onOpen);
    fireEvent.click(screen.getByRole('button', { name: 'Open in the journal' }));
    expect(onOpen).toHaveBeenCalledWith({ kind: 'page', path: '/journey/3?entry=2' });
  });
});
