import { beforeEach, describe, expect, it } from 'vitest';
import { buildUser } from '../../../tests/helpers/factories';
import { render, screen } from '../../../tests/helpers/render';
import { resetAllStores, seedStore } from '../../../tests/helpers/store';
import { useAuthStore } from '../../store/authStore';
import AccountDemoLock from './AccountDemoLock';

beforeEach(() => resetAllStores());

function renderCards() {
  return render(
    <AccountDemoLock>
      <button type="button">Save profile</button>
    </AccountDemoLock>
  );
}

describe('AccountDemoLock', () => {
  it('FE-COMP-ACCOUNTDEMOLOCK-001: the shared demo account sees its cards under the lock, with the reason', () => {
    seedStore(useAuthStore, { demoMode: true, user: buildUser({ email: 'demo@trek.app' }) });
    const { container } = renderCards();
    expect(screen.getByRole('note')).toHaveTextContent('The shared demo account cannot be changed.');
    expect(screen.queryByRole('button', { name: 'Save profile' })).not.toBeInTheDocument();
    expect(container.querySelector('[data-demo-lock] [inert]')).toContainElement(
      screen.getByRole('button', { hidden: true, name: 'Save profile' })
    );
  });

  it('FE-COMP-ACCOUNTDEMOLOCK-002: the admin of a demo instance gets the cards as they are', () => {
    seedStore(useAuthStore, { demoMode: true, user: buildUser({ email: 'admin@trek.app', role: 'admin' }) });
    const { container } = renderCards();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeEnabled();
    expect(container.querySelector('[data-demo-lock]')).toBeNull();
  });

  it('FE-COMP-ACCOUNTDEMOLOCK-003: the demo address on an instance that is not a demo is left alone', () => {
    seedStore(useAuthStore, { demoMode: false, user: buildUser({ email: 'demo@trek.app' }) });
    renderCards();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeEnabled();
  });
});
