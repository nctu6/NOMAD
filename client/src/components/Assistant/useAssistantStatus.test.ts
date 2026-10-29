/**
 * FE-AI-STATUS-001 to FE-AI-STATUS-003
 *
 * The views of the assistant ask for its status through this hook: not while
 * both addons that open /api/ai are off, where the server answers 404, and
 * as soon as one comes on, which the addon list can say after the view
 * mounted (the first load, an admin's switch). The assistant's own addon
 * switching asks again while AI parsing keeps /api/ai open.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import type { AiStatusResponse } from '@trek/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetAllStores, seedStore } from '../../../tests/helpers/store';
import { aiConnectionsRepo } from '../../repo/aiConnectionsRepo';
import { useAddonStore } from '../../store/addonStore';
import { useAssistantStore } from '../../store/assistantStore';
import { useAssistantStatus } from './useAssistantStatus';

const INITIAL = useAssistantStore.getState();
const STATUS = { available: true, retention: { mode: 'days', days: 90 } } as AiStatusResponse;

/** The addon list as it lands from the server, with these addons on. */
const addonsOn = (...ids: string[]) =>
  seedStore(useAddonStore, { loaded: true, addons: ids.map((id) => ({ id, enabled: true })) });

beforeEach(() => {
  resetAllStores();
});

afterEach(() => {
  useAssistantStore.setState(INITIAL, true);
  vi.restoreAllMocks();
});

describe('useAssistantStatus', () => {
  it('FE-AI-STATUS-001: asks nothing before the addon list or with both addons off, and asks once one comes on', async () => {
    const status = vi.spyOn(aiConnectionsRepo, 'status').mockResolvedValue(STATUS);
    renderHook(() => useAssistantStatus());
    act(() => addonsOn('mcp'));
    expect(status).not.toHaveBeenCalled();
    expect(useAssistantStore.getState().status).toBeNull();

    act(() => addonsOn('ai_assistant'));
    await waitFor(() => expect(useAssistantStore.getState().status).toEqual(STATUS));
    expect(status).toHaveBeenCalledTimes(1);

    // The list read again with the assistant still on asks nothing more.
    act(() => addonsOn('ai_assistant', 'mcp'));
    expect(status).toHaveBeenCalledTimes(1);
  });

  it('FE-AI-STATUS-002: with AI parsing on it asks at once, and the last addon going off hides the assistant', async () => {
    const status = vi.spyOn(aiConnectionsRepo, 'status').mockResolvedValue(STATUS);
    addonsOn('llm_parsing');
    renderHook(() => useAssistantStatus());
    await waitFor(() => expect(useAssistantStore.getState().status).toEqual(STATUS));
    expect(status).toHaveBeenCalledTimes(1);

    act(() => addonsOn());
    expect(useAssistantStore.getState().status).toBeNull();
    expect(status).toHaveBeenCalledTimes(1);
  });

  it('FE-AI-STATUS-003: with AI parsing on, the assistant switched on or off asks again', async () => {
    const status = vi.spyOn(aiConnectionsRepo, 'status').mockResolvedValue(STATUS);
    addonsOn('llm_parsing');
    renderHook(() => useAssistantStatus());
    await waitFor(() => expect(status).toHaveBeenCalledTimes(1));

    act(() => addonsOn('llm_parsing', 'ai_assistant'));
    await waitFor(() => expect(status).toHaveBeenCalledTimes(2));

    act(() => addonsOn('llm_parsing'));
    await waitFor(() => expect(status).toHaveBeenCalledTimes(3));
  });
});
