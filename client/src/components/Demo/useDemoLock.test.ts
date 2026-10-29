import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildUser } from '../../../tests/helpers/factories';
import { resetAllStores, seedStore } from '../../../tests/helpers/store';
import { useAuthStore } from '../../store/authStore';
import { useDemoAccountLock } from './useDemoLock';

beforeEach(() => resetAllStores());

describe('useDemoAccountLock', () => {
  it('FE-HOOK-DEMOLOCK-001: locks the demo account on a demo instance', () => {
    seedStore(useAuthStore, { demoMode: true, user: buildUser({ email: 'demo@trek.app' }) });
    expect(renderHook(() => useDemoAccountLock()).result.current).toBe(true);
  });

  it('FE-HOOK-DEMOLOCK-002: knows the address the demo account had before the rename', () => {
    seedStore(useAuthStore, { demoMode: true, user: buildUser({ email: 'demo@nomad.app' }) });
    expect(renderHook(() => useDemoAccountLock()).result.current).toBe(true);
  });

  it('FE-HOOK-DEMOLOCK-003: leaves the admin of a demo instance alone', () => {
    seedStore(useAuthStore, { demoMode: true, user: buildUser({ email: 'admin@trek.app', role: 'admin' }) });
    expect(renderHook(() => useDemoAccountLock()).result.current).toBe(false);
  });

  it('FE-HOOK-DEMOLOCK-004: leaves the demo address alone on an instance that is not a demo', () => {
    seedStore(useAuthStore, { demoMode: false, user: buildUser({ email: 'demo@trek.app' }) });
    expect(renderHook(() => useDemoAccountLock()).result.current).toBe(false);
  });

  it('FE-HOOK-DEMOLOCK-005: is off while nobody is signed in', () => {
    seedStore(useAuthStore, { demoMode: true, user: null });
    expect(renderHook(() => useDemoAccountLock()).result.current).toBe(false);
  });
});
