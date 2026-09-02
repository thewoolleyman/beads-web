import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { SubtaskList } from '@/components/subtask-list';
import type { Bead } from '@/types';

const LONG_TITLE =
  'Dispatcher-setting writes are uncommitted and the Settings pane silently re-renders the stale value';
const LONG_DESCRIPTION =
  'The console records a completed command and a domain event, yet the dispatcher never observes the new policy value at all.';

function makeChild(overrides: Partial<Bead> = {}): Bead {
  return {
    id: 'livespec-console-beads-fabro-abc',
    title: LONG_TITLE,
    description: LONG_DESCRIPTION,
    status: 'open',
    priority: 1,
    issue_type: 'bug',
    created_at: '2026-07-20T10:00:00Z',
    updated_at: '2026-07-20T10:00:00Z',
    comments: [],
    ...overrides,
  } as Bead;
}

describe('SubtaskList row titles', () => {
  it('renders the whole title instead of cutting it at a fixed character count', () => {
    render(
      <SubtaskList
        childTasks={[makeChild()]}
        projectId="be5630e9"
        onChildClick={vi.fn()}
        isExpanded
      />,
    );

    expect(screen.getByText(LONG_TITLE)).toBeInTheDocument();
    expect(screen.getByText(LONG_DESCRIPTION)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('…');
  });

  it('leaves overflow to CSS so a title only ellipsizes when it truly does not fit', () => {
    render(
      <SubtaskList
        childTasks={[makeChild()]}
        projectId="be5630e9"
        onChildClick={vi.fn()}
        isExpanded
      />,
    );

    const title = screen.getByText(LONG_TITLE);
    expect(title).toHaveClass('truncate');

    // The title column has to be free to grow into the row and to shrink
    // below its content width, otherwise `truncate` never gets a chance.
    const column = title.parentElement as HTMLElement;
    expect(column).toHaveClass('flex-1');
    expect(column).toHaveClass('min-w-0');
  });
});
