import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { ActivityTimeline } from '@/components/activity-timeline';
import type { Bead } from '@/types';

const LONG_CHILD_TITLE =
  'Dispatcher-setting writes are uncommitted and the Settings pane re-renders the stale value';

function makeBead(overrides: Partial<Bead> = {}): Bead {
  return {
    id: 'livespec-console-beads-fabro-pzbdbo',
    title: 'Console epic',
    description: '',
    status: 'open',
    priority: 1,
    issue_type: 'epic',
    created_at: '2026-07-20T10:00:00Z',
    updated_at: '2026-07-20T10:00:00Z',
    comments: [],
    ...overrides,
  } as Bead;
}

describe('ActivityTimeline event descriptions', () => {
  it('names a child task in full instead of cutting it at 30 characters', () => {
    render(
      <ActivityTimeline
        bead={makeBead()}
        comments={[]}
        childBeads={[makeBead({ id: 'child-1', title: LONG_CHILD_TITLE, issue_type: 'bug' })]}
      />,
    );

    expect(screen.getByText(`Task created: ${LONG_CHILD_TITLE}`)).toBeInTheDocument();
  });

  it('leaves overflow to CSS so an event line only ellipsizes when it must', () => {
    render(
      <ActivityTimeline
        bead={makeBead()}
        comments={[]}
        childBeads={[makeBead({ id: 'child-1', title: LONG_CHILD_TITLE, issue_type: 'bug' })]}
      />,
    );

    const line = screen.getByText(`Task created: ${LONG_CHILD_TITLE}`);
    expect(line).toHaveClass('truncate');
    // It has to be free to grow into the row and to shrink below its content
    // width, or `truncate` never engages and the row overflows instead.
    expect(line).toHaveClass('flex-1');
    expect(line).toHaveClass('min-w-0');
  });
});
