import { useCallback, useMemo } from 'react';
import { useMatch, useNavigate } from 'react-router';

import type { AssistantChatTrip } from '../../../components/Assistant/assistantViewContext';
import type { EntityTarget } from '../../../components/Assistant/cards/cardTypes';
import { chatPagePath, useAssistantHome, useRouteJournalChat } from '../../../components/Assistant/useAssistantHome';
import { useAssistantStatus } from '../../../components/Assistant/useAssistantStatus';
import { useAssistantStore } from '../../../store/assistantStore';
import { AssistantScreen, type MapHops } from '../trip/assistant/MAssistantScreen';

/**
 * The assistant on the phone outside a trip: the home chat, full screen over
 * the dashboard, Vacay, Atlas, the collections or the settings, opened from
 * the dashboard's head or the dock's More list. It knows all of the user's
 * trips; going on in one trip's own chat opens that trip with its chat on
 * screen and the question waiting in its composer. Another page a card points
 * at closes the chat and opens there.
 *
 * On a journal's page it shows that journal's chat instead. Inside a trip
 * the trip's own screen (MAssistantScreen) shows its chat, so this one stays
 * away there. Nothing shows until the assistant has a
 * connection this user can use.
 */
export default function MAssistantHomeScreen() {
  const navigate = useNavigate();
  const inTrip = useMatch('/trips/:id/*') !== null;
  const available = useAssistantStore((s) => s.status?.available === true);
  const open = useAssistantStore((s) => s.window.open);
  const minimized = useAssistantStore((s) => s.window.minimized);
  const close = useAssistantStore((s) => s.close);

  // The trip's screen (or the journal's) takes over with the window still open, so its chat comes up there.
  const switchTo = useCallback((chat: AssistantChatTrip) => void navigate(chatPagePath(chat)), [navigate]);
  const home = useAssistantHome(switchTo);
  // On a journal's page the chat is that journal's, the journey's conversation it shares with TREK Studio.
  const journal = useRouteJournalChat();
  const chat = journal ?? home.chat;
  const hops = useMemo(
    (): MapHops => ({
      open: (target: EntityTarget) => {
        if (target.kind !== 'page') return;
        close();
        void navigate(target.path);
      },
    }),
    [close, navigate]
  );

  // The desktop window loads this itself; on the phone the pages outside a trip ask here.
  useAssistantStatus();

  if (inTrip || !available || !open || minimized) return null;
  // Mounted beside MobileShell, not inside it, so the --m-* tokens the screen paints
  // with only resolve under an m-root of its own; without it the chat is see-through.
  return (
    <div className="m-root">
      <AssistantScreen
        tripId={chat.id}
        tripTitle={chat.title}
        hidden={false}
        hops={hops}
        onOpenTripChat={journal ? undefined : home.openTripChat}
      />
    </div>
  );
}
