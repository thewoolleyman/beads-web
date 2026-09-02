import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the HTTP layer before importing the parser.
const readMock = vi.fn();
vi.mock('@/lib/api', () => ({
  beads: {
    read: (...args: unknown[]) => readMock(...args),
  },
}));

// eslint-disable-next-line import/first
import * as parser from '@/lib/beads-parser';

interface RawBead {
  id: string;
  status: string;
  parent_id?: string;
  children?: string[];
}

function raw(id: string, status: string, extra: Partial<RawBead> = {}): RawBead {
  return { id, status, ...extra };
}

beforeEach(() => {
  readMock.mockReset();
});

describe('loadProjectBeads status handling', () => {
  it('keeps a livespec status verbatim instead of remapping it to open', async () => {
    readMock.mockResolvedValue({
      beads: [raw('a-1', 'pending-approval'), raw('a-2', 'ready'), raw('a-3', 'active')],
    });

    const beads = await parser.loadProjectBeads('/proj');

    expect(beads.map((b) => b.status)).toEqual(['pending-approval', 'ready', 'active']);
  });

  it('keeps statuses that used to be remapped with a badge', async () => {
    readMock.mockResolvedValue({
      beads: [raw('a-1', 'blocked'), raw('a-2', 'deferred'), raw('a-3', 'done')],
    });

    const beads = await parser.loadProjectBeads('/proj');

    expect(beads.map((b) => b.status)).toEqual(['blocked', 'deferred', 'done']);
  });

  it('attaches no status badge or original-status metadata', async () => {
    readMock.mockResolvedValue({ beads: [raw('a-1', 'triage')] });

    const [bead] = await parser.loadProjectBeads('/proj');

    expect(bead._statusBadge).toBeUndefined();
    expect(bead._originalStatus).toBeUndefined();
  });

  it('drops tombstone beads', async () => {
    readMock.mockResolvedValue({
      beads: [raw('a-1', 'active'), raw('a-2', 'tombstone')],
    });

    const beads = await parser.loadProjectBeads('/proj');

    expect(beads.map((b) => b.id)).toEqual(['a-1']);
  });

  it('retains child beads that carry a parent_id', async () => {
    readMock.mockResolvedValue({
      beads: [
        raw('epic-1', 'active', { children: ['task-1'] }),
        raw('task-1', 'ready', { parent_id: 'epic-1' }),
      ],
    });

    const beads = await parser.loadProjectBeads('/proj');

    expect(beads.map((b) => b.id)).toEqual(['epic-1', 'task-1']);
    expect(beads.find((b) => b.id === 'task-1')?.status).toBe('ready');
  });

  it('defaults a missing comments array to empty', async () => {
    readMock.mockResolvedValue({ beads: [raw('a-1', 'ready')] });

    const [bead] = await parser.loadProjectBeads('/proj');

    expect(bead.comments).toEqual([]);
  });
});

describe('unknown-status plumbing', () => {
  it('is gone — every status now has a lane', () => {
    const exported = Object.keys(parser);
    expect(exported).not.toContain('getUnknownStatusBeads');
    expect(exported).not.toContain('getUnknownStatusNames');
  });
});

describe('groupBeadsByStatus', () => {
  function bead(id: string, status: string, updated: string) {
    return { id, status, updated_at: updated } as never;
  }

  it('groups by the raw status instead of folding onto four native buckets', () => {
    const grouped = parser.groupBeadsByStatus([
      bead('a-1', 'ready', '2026-01-03T00:00:00Z'),
      bead('a-2', 'pending-approval', '2026-01-02T00:00:00Z'),
      bead('a-3', 'ready', '2026-01-04T00:00:00Z'),
      bead('a-4', 'closed', '2026-01-01T00:00:00Z'),
    ]);

    expect(Object.keys(grouped).sort()).toEqual([
      'closed',
      'pending-approval',
      'ready',
    ]);
    expect(grouped.ready).toHaveLength(2);
    expect(grouped['pending-approval']).toHaveLength(1);
    expect(grouped.open).toBeUndefined();
  });

  it('sorts each bucket by updated_at descending', () => {
    const grouped = parser.groupBeadsByStatus([
      bead('a-1', 'active', '2026-01-01T00:00:00Z'),
      bead('a-2', 'active', '2026-01-05T00:00:00Z'),
    ]);

    expect(grouped.active.map((b) => b.id)).toEqual(['a-2', 'a-1']);
  });

  it('creates no buckets for an empty bead list', () => {
    expect(parser.groupBeadsByStatus([])).toEqual({});
  });

  it('drops beads with a blank status', () => {
    const grouped = parser.groupBeadsByStatus([
      bead('a-1', '', '2026-01-01T00:00:00Z'),
      bead('a-2', 'ready', '2026-01-01T00:00:00Z'),
    ]);

    expect(Object.keys(grouped)).toEqual(['ready']);
  });
});
