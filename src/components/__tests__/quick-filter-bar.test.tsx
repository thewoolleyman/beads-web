import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { deriveLanes } from '@/lib/lanes';
import type { Lane } from '@/lib/lanes';

import { QuickFilterBar } from '../quick-filter-bar';

function renderBar(lanes: Lane[], onStatusToggle = vi.fn()) {
  render(
    <QuickFilterBar
      lanes={lanes}
      typeFilter="all"
      onTypeFilterChange={vi.fn()}
      todayOnly={false}
      onTodayOnlyChange={vi.fn()}
      sortField="created_at"
      sortDirection="desc"
      onSortChange={vi.fn()}
      search=""
      onSearchChange={vi.fn()}
      statuses={[]}
      onStatusToggle={onStatusToggle}
      owners={[]}
      onOwnerToggle={vi.fn()}
      availableOwners={[]}
      onClearFilters={vi.fn()}
      hasActiveFilters={false}
    />,
  );
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Filter options' }), {
    button: 0,
    ctrlKey: false,
    pointerType: 'mouse',
  });
  return { onStatusToggle };
}

/** Lanes derived from a livespec-style project with one data-only status. */
const projectLanes = deriveLanes([
  { status: 'ready' },
  { status: 'acceptance' },
  { status: 'triage' },
]);

describe('QuickFilterBar status filter', () => {
  it('offers one option per lane, in lane order, including data-only statuses', () => {
    renderBar(projectLanes);

    expect(screen.getAllByRole('menuitemcheckbox').map((item) => item.textContent)).toEqual([
      'Backlog',
      'Pending Approval',
      'Ready',
      'Active',
      'Acceptance',
      'Blocked',
      'Closed',
      'Triage',
    ]);
  });

  it('toggles the raw status of the chosen lane', () => {
    const { onStatusToggle } = renderBar(projectLanes);

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Pending Approval' }));

    expect(onStatusToggle).toHaveBeenCalledWith('pending-approval');
  });
});
