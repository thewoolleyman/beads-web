import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { beadHref } from '@/lib/bead-link';
import type { Bead, Epic } from '@/types';

import { BeadCard } from '../bead-card';
import { EpicCard } from '../epic-card';

/** Layout comes from the theme; every layout must produce the same link. */
const themeState = vi.hoisted(() => ({ layout: 'standard' as string }));

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({ layout: themeState.layout }),
}));

/** Deliberately awkward so the test also pins percent-encoding. */
const PROJECT_ID = 'dolt://proj 1';

const LAYOUTS = ['standard', 'compact-row', 'property-tags'] as const;

function bead(id: string, title: string, extra: Partial<Bead> = {}): Bead {
  return {
    id,
    title,
    status: 'ready',
    priority: 2,
    issue_type: 'task',
    owner: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    comments: [],
    ...extra,
  };
}

const target = bead('bd-target', 'Deep linkable item');

function renderCard(onSelect = vi.fn()) {
  const view = render(
    <BeadCard bead={target} allBeads={[target]} projectId={PROJECT_ID} onSelect={onSelect} />,
  );
  return { ...view, onSelect, link: screen.getByRole('link', { name: /Deep linkable item/ }) };
}

beforeEach(() => {
  themeState.layout = 'standard';
  vi.clearAllMocks();
});

describe('BeadCard deep link', () => {
  it.each(LAYOUTS)('is a real anchor to the bead deep link in the %s layout', (layout) => {
    themeState.layout = layout;

    const { link } = renderCard();

    expect(link).toHaveAttribute('href', beadHref(PROJECT_ID, 'bd-target'));
    expect(link.getAttribute('href')).toBe('/project?id=dolt%3A%2F%2Fproj%201&bead=bd-target');
  });

  it('opens the detail in place on a plain click and does not navigate', () => {
    const { link, onSelect } = renderCard();

    const notCancelled = fireEvent.click(link);

    expect(onSelect).toHaveBeenCalledWith(target);
    expect(notCancelled).toBe(false);
  });

  it('leaves a ctrl-click to the browser', () => {
    const { link, onSelect } = renderCard();

    const notCancelled = fireEvent.click(link, { ctrlKey: true });

    expect(onSelect).not.toHaveBeenCalled();
    expect(notCancelled).toBe(true);
  });

  it('leaves a middle-click to the browser', () => {
    const { link, onSelect } = renderCard();

    const notCancelled = fireEvent.click(link, { button: 1 });

    expect(onSelect).not.toHaveBeenCalled();
    expect(notCancelled).toBe(true);
  });

  it('opens the detail when Enter is pressed on the card', () => {
    const { link, onSelect } = renderCard();

    fireEvent.keyDown(link, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith(target);
  });
});

const child = bead('bd-child', 'Child of the epic');
const epic: Epic = {
  ...bead('bd-epic', 'Epic with children', { issue_type: 'epic', status: 'active' }),
  children: ['bd-child'],
} as Epic;

function renderEpic(onSelect = vi.fn(), onChildClick = vi.fn()) {
  const view = render(
    <EpicCard
      epic={epic}
      allBeads={[epic, child]}
      projectId={PROJECT_ID}
      onSelect={onSelect}
      onChildClick={onChildClick}
    />,
  );
  return { ...view, onSelect, onChildClick };
}

describe('EpicCard deep link', () => {
  it.each(LAYOUTS)('links the epic to its own deep link in the %s layout', (layout) => {
    themeState.layout = layout;

    renderEpic();

    expect(screen.getByRole('link', { name: /Epic with children/ })).toHaveAttribute(
      'href',
      beadHref(PROJECT_ID, 'bd-epic'),
    );
  });

  it('links every child row to the child deep link', () => {
    renderEpic();

    expect(screen.getByRole('link', { name: /Child of the epic/ })).toHaveAttribute(
      'href',
      beadHref(PROJECT_ID, 'bd-child'),
    );
  });

  it('opens a child in place on a plain click', () => {
    const { onChildClick, onSelect } = renderEpic();

    const notCancelled = fireEvent.click(
      screen.getByRole('link', { name: /Child of the epic/ }),
    );

    expect(onChildClick).toHaveBeenCalledWith(child);
    expect(onSelect).not.toHaveBeenCalled();
    expect(notCancelled).toBe(false);
  });

  it.each(LAYOUTS)('never nests one anchor inside another in the %s layout', (layout) => {
    themeState.layout = layout;

    const { container } = renderEpic();

    expect(container.querySelectorAll('a a')).toHaveLength(0);
  });
});
