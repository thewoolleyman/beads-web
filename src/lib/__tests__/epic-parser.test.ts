import { describe, it, expect } from 'vitest';

import { computeEpicProgress } from '@/lib/epic-parser';
import type { Bead, Epic } from '@/types';

function bead(id: string, status: string, extra: Partial<Bead> = {}): Bead {
  return {
    id,
    title: id,
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

function epic(children: string[]): Epic {
  return { ...bead('epic-1', 'active'), issue_type: 'epic', children } as Epic;
}

describe('computeEpicProgress', () => {
  it('counts livespec active children as in progress', () => {
    const children = [bead('c-1', 'active'), bead('c-2', 'ready'), bead('c-3', 'closed')];

    const progress = computeEpicProgress(epic(['c-1', 'c-2', 'c-3']), [
      epic(['c-1', 'c-2', 'c-3']),
      ...children,
    ]);

    expect(progress).toMatchObject({ total: 3, completed: 1, inProgress: 1 });
  });

  it("still counts bd's native in_progress children", () => {
    const children = [bead('c-1', 'in_progress'), bead('c-2', 'active')];

    const progress = computeEpicProgress(epic(['c-1', 'c-2']), [epic(['c-1', 'c-2']), ...children]);

    expect(progress.inProgress).toBe(2);
  });
});
