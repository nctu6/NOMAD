import { describe, expect, it } from 'vitest';
import { render, screen } from '../../../tests/helpers/render';
import DemoLock from './DemoLock';

describe('DemoLock', () => {
  it('FE-COMP-DEMOLOCK-001: unlocked, the section is the section and nothing more', () => {
    const { container } = render(
      <DemoLock locked={false} reason="Not here.">
        <button type="button">Create key</button>
      </DemoLock>
    );
    expect(screen.getByRole('button', { name: 'Create key' })).toBeEnabled();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(container.querySelector('[data-demo-lock]')).toBeNull();
  });

  it('FE-COMP-DEMOLOCK-002: locked, the section stays visible but out of reach, under the badge and the reason', () => {
    const { container } = render(
      <DemoLock locked reason="API keys cannot be created in the demo.">
        <button type="button">Create key</button>
      </DemoLock>
    );
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent('Demo mode');
    expect(note).toHaveTextContent('API keys cannot be created in the demo.');
    expect(screen.queryByRole('button', { name: 'Create key' })).not.toBeInTheDocument();
    const veiled = container.querySelector('[data-demo-lock] > [inert]');
    expect(veiled).toHaveAttribute('aria-hidden', 'true');
    expect(veiled).toContainElement(screen.getByRole('button', { hidden: true, name: 'Create key' }));
    expect(note.getAttribute('style')).toContain('repeating-linear-gradient');
    expect(note.getAttribute('style')).toContain('var(--text-primary)');
  });

  it('FE-COMP-DEMOLOCK-003: a single row puts the note in its middle, a section at its top', () => {
    const { rerender } = render(
      <DemoLock locked reason="r" size="row">
        <span>row</span>
      </DemoLock>
    );
    expect(screen.getByRole('note').className).toContain('items-center');
    rerender(
      <DemoLock locked reason="r">
        <span>section</span>
      </DemoLock>
    );
    expect(screen.getByRole('note').className).toContain('items-start');
  });
});
