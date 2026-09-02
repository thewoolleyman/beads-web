import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { DEFAULT_LANES } from '@/lib/lanes';
import type { Bead } from '@/types';

import KanbanBoard from '../kanban-board';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('id=p1'),
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

let boardBeads: Bead[] = [];

vi.mock('@/hooks/use-project', () => ({
  useProject: () => ({
    project: { id: 'p1', name: 'Proj', path: 'dolt://proj', tags: [], lastOpened: '', createdAt: '' },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-beads', () => ({
  useBeads: () => ({
    beads: boardBeads,
    ticketNumbers: new Map<string, number>(),
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-bead-filters', () => ({
  useBeadFilters: (beads: Bead[]) => ({
    filters: { search: '', statuses: [], owners: [], todayOnly: false, sortField: 'ticket_number', sortDirection: 'desc' },
    setFilters: vi.fn(),
    filteredBeads: beads,
    clearFilters: vi.fn(),
    hasActiveFilters: false,
    availableOwners: [],
  }),
}));

vi.mock('@/hooks/use-github-status', () => ({
  useGitHubStatus: () => ({ hasRemote: true, isAuthenticated: true, isLoading: false }),
}));

vi.mock('@/hooks/use-worktree-statuses', () => ({
  useWorktreeStatuses: () => ({ statuses: {} }),
}));

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({ theme: { headerVariant: 'standard' } }),
}));

function bead(id: string, title: string, status: string, extra: Partial<Bead> = {}): Bead {
  return {
    id,
    title,
    status,
    priority: 2,
    issue_type: 'task',
    owner: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    comments: [],
    ...extra,
  };
}

/** Lane headings, in render order. */
function laneTitles(): string[] {
  return screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent ?? '');
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) }),
  );
  boardBeads = [];
});

describe('KanbanBoard lanes', () => {
  it('renders one lane per configured status plus any extra status in the data', () => {
    boardBeads = [
      bead('p-1', 'Ready item', 'ready'),
      bead('p-2', 'Triaged item', 'triage'),
      bead('p-3', 'Closed item', 'closed'),
    ];

    render(<KanbanBoard />);

    expect(laneTitles()).toEqual([
      'Backlog',
      'Pending Approval',
      'Ready',
      'Active',
      'Acceptance',
      'Blocked',
      'Closed',
      'Triage',
    ]);
    expect(laneTitles().length).toBe(DEFAULT_LANES.length + 1);
  });

  it('puts each bead in the lane of its raw status', () => {
    boardBeads = [bead('p-1', 'Ready item', 'ready'), bead('p-2', 'Active item', 'active')];

    render(<KanbanBoard />);

    const readyLane = screen.getByRole('heading', { level: 2, name: 'Ready' }).closest('div.theme-column');
    expect(readyLane).not.toBeNull();
    expect(within(readyLane as HTMLElement).getByText('Ready item')).toBeInTheDocument();
    expect(within(readyLane as HTMLElement).queryByText('Active item')).toBeNull();
  });

  it('renders a child task as its own card without removing the epic card', () => {
    boardBeads = [
      bead('p-1', 'Parent epic', 'active', { issue_type: 'epic', children: ['p-2'] }),
      bead('p-2', 'Child task', 'ready', { parent_id: 'p-1' }),
    ];

    render(<KanbanBoard />);

    const readyLane = screen.getByRole('heading', { level: 2, name: 'Ready' }).closest('div.theme-column');
    expect(within(readyLane as HTMLElement).getByText('Child task')).toBeInTheDocument();

    const activeLane = screen.getByRole('heading', { level: 2, name: 'Active' }).closest('div.theme-column');
    expect(within(activeLane as HTMLElement).getByText('Parent epic')).toBeInTheDocument();
  });

  it('shows no unknown-status warning', () => {
    boardBeads = [bead('p-1', 'Triaged item', 'triage')];

    render(<KanbanBoard />);

    expect(screen.queryByText(/unknown status/i)).toBeNull();
  });

  it('sizes the lane grid to the number of lanes instead of a fixed four columns', () => {
    boardBeads = [bead('p-1', 'Triaged item', 'triage')];

    const { container } = render(<KanbanBoard />);

    const grid = container.querySelector('main .grid') as HTMLElement;
    expect(grid).not.toBeNull();
    expect(grid.className).not.toContain('grid-cols-4');
    expect(grid.style.gridTemplateColumns).toBe(
      `repeat(${DEFAULT_LANES.length + 1}, minmax(280px, 1fr))`,
    );
  });
});
