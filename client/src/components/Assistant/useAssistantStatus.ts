import { useEffect } from 'react';

import { useAddonStore } from '../../store/addonStore';
import { aiRoutesOpen, useAssistantStore } from '../../store/assistantStore';

/**
 * Asks for the assistant's status when a view of it mounts, and again when
 * either addon that opens /api/ai is switched: the addon list can land after
 * the view, and an admin can switch either addon while it is open. The
 * assistant's own addon counts on its own, since the status says it runs only
 * while that one is on, even with AI parsing keeping /api/ai open. The store
 * asks the server only while one is on (aiRoutesOpen).
 */
export function useAssistantStatus(): void {
  const loadStatus = useAssistantStore((s) => s.loadStatus);
  const routesOpen = useAddonStore(aiRoutesOpen);
  const assistantOn = useAddonStore((s) => s.isEnabled('ai_assistant'));

  useEffect(() => {
    void loadStatus();
  }, [routesOpen, assistantOn, loadStatus]);
}
