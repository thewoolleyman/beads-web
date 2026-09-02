import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import type { Bead } from '@/types';

import { BeadDetail } from '../bead-detail';

/**
 * The detail header meta row must speak the project's own lifecycle
 * vocabulary, not bd's four native statuses. A bead whose raw status is
 * `ready` used to render as "Open" because `formatStatus` folded every
 * unknown status onto the native set.
 */
function makeBead(status: string): Bead {
  return {
    id: 'livespec-console-beads-fabro-uropo5',
    title: 'A lifecycle bead',
    status,
    priority: 1,
    issue_type: 'task',
    owner: 'maintainer',
    created_at: '2026-09-01T12:00:00Z',
    updated_at: '2026-09-01T12:00:00Z',
    comments: [],
  };
}

function renderDetail(status: string) {
  // No projectPath => read-only viewer, which renders the status as text
  // rather than as a write-path <select>.
  return render(
    <BeadDetail
      bead={makeBead(status)}
      projectId="dolt://proj"
      open
      onOpenChange={() => {}}
    />
  );
}

/** Text of the header meta cell that carries the status dot. */
function statusCellText(container: HTMLElement, status: string): string {
  const dot = container.querySelector(`[data-status-dot="${status}"]`);
  expect(dot).not.toBeNull();
  return dot!.parentElement?.textContent ?? '';
}

describe('BeadDetail status label', () => {
  it('humanizes the raw lifecycle status instead of showing a native label', () => {
    const { container } = renderDetail('ready');

    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(statusCellText(container, 'ready')).toBe('Ready');
  });

  it('humanizes a multi-word raw status', () => {
    renderDetail('pending-approval');

    expect(screen.getByText('Pending Approval')).toBeInTheDocument();
  });

  it('still humanizes bd native statuses', () => {
    renderDetail('in_progress');

    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('tints the status dot with the lane accent for the raw status', () => {
    const { container } = renderDetail('acceptance');

    const dot = container.querySelector('[data-status-dot="acceptance"]');
    expect(dot).not.toBeNull();
    expect((dot as HTMLElement).style.color).toContain('--status-review');
  });
});
