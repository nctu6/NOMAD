import { useCallback, useMemo } from 'react';
import { useMatch } from 'react-router';

import { useTranslation } from '../../i18n';
import { assistantChatKey, assistantScopeOf, HOME_CHAT_KEY } from '../../store/assistantChatKey';
import { useAssistantStore } from '../../store/assistantStore';
import { useJourneyStore } from '../../store/journeyStore';
import type { AssistantChatTrip } from './assistantViewContext';

/**
 * The home chat, the assistant outside any one trip, as the desktop window
 * and the phone screen both show it: the key its conversations are kept
 * under, the name its head carries, and the way into one trip's own chat.
 * That way leaves the question the home chat handed over waiting in the
 * trip's composer, ready to send, and then lets the view switch (the window
 * shows that trip's chat in place, the phone opens the trip with its chat).
 */
export function useAssistantHome(switchTo: (trip: AssistantChatTrip) => void) {
  const { t } = useTranslation();
  const setDraft = useAssistantStore((s) => s.setDraft);

  const openTripChat = useCallback(
    (trip: AssistantChatTrip, question: string | null) => {
      // A question typed there already stays; the handed-over one only fills an empty composer.
      const typed = useAssistantStore.getState().byTrip[trip.id]?.draft ?? '';
      if (question && !typed.trim()) setDraft(trip.id, question);
      switchTo(trip);
    },
    [setDraft, switchTo]
  );

  const title = t('assistant.home.title');
  const chat = useMemo((): AssistantChatTrip => ({ id: HOME_CHAT_KEY, title }), [title]);
  return { chat, openTripChat };
}

/**
 * The way into the home chat on the pages outside a trip (the phone's
 * dashboard head and the dock's More list): offered only while the assistant
 * can run for this user, like every other way in.
 */
export function useAssistantHomeLauncher() {
  const available = useAssistantStore((s) => s.status?.available === true);
  const open = useAssistantStore((s) => s.open);
  return { available, open };
}

/**
 * The journal on screen as a chat: on a journey's own page the journey's
 * conversation (the one TREK Studio holds too), under its key and with the
 * journey's title once the page has loaded it; null elsewhere and in the
 * Studio, whose column holds that chat itself.
 */
export function useRouteJournalChat(): AssistantChatTrip | null {
  const match = useMatch('/journey/:id/*');
  const inStudio = useMatch('/journey/:id/studio/*') !== null;
  const id = Number(match?.params.id);
  const journeyId = !inStudio && Number.isInteger(id) && id > 0 ? id : null;
  const title = useJourneyStore((s) => (s.current && s.current.id === journeyId ? s.current.title : ''));
  return useMemo(
    () => (journeyId === null ? null : { id: assistantChatKey({ kind: 'journey', journeyId }), title }),
    [journeyId, title]
  );
}

/** The page a chat switched to from the home chat lives on: a journey's for its key, a trip's otherwise. */
export function chatPagePath(chat: AssistantChatTrip): string {
  const scope = assistantScopeOf(chat.id);
  return scope.kind === 'journey' ? `/journey/${scope.journeyId}` : `/trips/${chat.id}`;
}
