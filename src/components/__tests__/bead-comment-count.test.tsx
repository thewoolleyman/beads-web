import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Bead, Epic } from '@/types';

import { BeadCard } from '../bead-card';
import { EpicCard } from '../epic-card';

const themeState = vi.hoisted(() => ({ layout: 'standard' as string }));

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({ layout: themeState.layout }),
}));

/** The layouts that render a comment count (compact-row shows none). */
const LAYOUTS = ['standard', 'property-tags'] as const;

/**
 * A bead exactly as `/api/beads` now sends it: a server-side
 * `comment_count` and NO comment bodies.
 */
function listBead(id: string, title: string, extra: Partial<Bead> = {}): Bead {
  return {
    id,
    title,
    status: 'ready',
    priority: 2,
    issue_type: 'task',
    owner: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...extra,
  };
}

beforeEach(() => {
  themeState.layout = 'standard';
});

describe('BeadCard comment count', () => {
  it.each(LAYOUTS)('shows comment_count without any comment bodies in the %s layout', (layout) => {
    themeState.layout = layout;
    const bead = listBead('bd-1', 'Counted item', { comment_count: 3 });

    render(<BeadCard bead={bead} allBeads={[bead]} projectId="p" onSelect={vi.fn()} />);

    expect(screen.getByText(/3 comments/)).toBeInTheDocument();
  });

  it('uses the singular for one comment', () => {
    const bead = listBead('bd-1', 'Counted item', { comment_count: 1 });

    render(<BeadCard bead={bead} allBeads={[bead]} projectId="p" onSelect={vi.fn()} />);

    expect(screen.getByText(/1 comment\b/)).toBeInTheDocument();
  });

  it('shows no count when comment_count is zero', () => {
    const bead = listBead('bd-1', 'Quiet item', { comment_count: 0 });

    render(<BeadCard bead={bead} allBeads={[bead]} projectId="p" onSelect={vi.fn()} />);

    expect(screen.queryByText(/comments?\b/)).not.toBeInTheDocument();
  });
});

describe('EpicCard comment count', () => {
  it.each(LAYOUTS)('shows the epic comment_count in the %s layout', (layout) => {
    themeState.layout = layout;
    const child = listBead('bd-child', 'Child');
    const epic = {
      ...listBead('bd-epic', 'Counted epic', { issue_type: 'epic', status: 'active', comment_count: 5 }),
      children: ['bd-child'],
    } as Epic;

    render(
      <EpicCard epic={epic} allBeads={[epic, child]} projectId="p" onSelect={vi.fn()} onChildClick={vi.fn()} />,
    );

    expect(screen.getByText(/5 comments/)).toBeInTheDocument();
  });
});
