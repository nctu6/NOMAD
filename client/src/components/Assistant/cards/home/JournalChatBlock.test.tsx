/**
 * FE-AI-JOURNALCHAT-001 to FE-AI-JOURNALCHAT-003
 *
 * The home chat's card that offers a journal's own chat: the journal with
 * its subtitle or days and what it holds, the question waiting there, and the
 * button that goes on in the chat kept under the journey's key.
 */
import type { JournalChatCard } from '@trek/shared';
import { describe, expect, it, vi } from 'vitest';

import { fireEvent, render, screen } from '../../../../../tests/helpers/render';
import { AssistantViewContext } from '../../assistantViewContext';
import { JournalChatBlock } from './JournalChatBlock';

const JAPAN: JournalChatCard = {
  kind: 'journalChat',
  journey: {
    id: 12,
    title: 'Japan 2026',
    subtitle: null,
    startDate: '2026-11-02',
    endDate: '2026-11-16',
    entryCount: 4,
    photoCount: 120,
  },
  question: 'Make a new entry for Berlin Hauptbahnhof',
};

function drawn(
  cards: JournalChatCard[],
  onOpenTripChat?: (chat: { id: number; title: string }, q: string | null) => void
) {
  return render(
    <AssistantViewContext.Provider value={{ tripId: 0, variant: 'fullscreen', onOpenTripChat }}>
      <JournalChatBlock cards={cards.map((card, index) => ({ toolCallId: `j${index}`, card }))} />
    </AssistantViewContext.Provider>
  );
}

describe('JournalChatBlock', () => {
  it('FE-AI-JOURNALCHAT-001: shows the journal, its days, what it holds and the question', () => {
    drawn([JAPAN]);
    expect(screen.getByRole('region', { name: 'Continue in a journal' })).toBeInTheDocument();
    expect(screen.getByText('Japan 2026')).toBeInTheDocument();
    expect(screen.getByText('4 entries')).toBeInTheDocument();
    expect(screen.getByText('120 photos')).toBeInTheDocument();
    expect(screen.getByText('Make a new entry for Berlin Hauptbahnhof')).toBeInTheDocument();
    // Nowhere to switch to: no button.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it("FE-AI-JOURNALCHAT-002: the button goes on in the journal's chat, under the journey's key", () => {
    const open = vi.fn();
    drawn([JAPAN], open);
    fireEvent.click(screen.getByRole('button', { name: "Continue in this journal's chat" }));
    expect(open).toHaveBeenCalledWith({ id: -12, title: 'Japan 2026' }, 'Make a new entry for Berlin Hauptbahnhof');
  });

  it('FE-AI-JOURNALCHAT-003: a subtitle stands for the days, an empty journal shows no photos, nothing draws nothing', () => {
    const bare: JournalChatCard = {
      ...JAPAN,
      journey: { ...JAPAN.journey, subtitle: 'Autumn', startDate: null, endDate: null, entryCount: 0, photoCount: 0 },
      question: null,
    };
    drawn([bare]);
    expect(screen.getByText('Autumn')).toBeInTheDocument();
    expect(screen.getByText('0 entries')).toBeInTheDocument();
    expect(screen.queryByText(/photos?$/)).not.toBeInTheDocument();
    const { container } = render(<JournalChatBlock cards={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
