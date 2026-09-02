import { createRef } from 'react';

import { fireEvent, renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { columnShortcuts, useKeyboardNavigation } from '@/hooks/use-keyboard-navigation';
import { DEFAULT_LANES } from '@/lib/lanes';
import type { Bead } from '@/types';

function bead(id: string, status: string): Bead {
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
  };
}

/** Two beads in each of the seven livespec lanes. */
const beads: Bead[] = DEFAULT_LANES.flatMap((status) => [
  bead(`${status}-1`, status),
  bead(`${status}-2`, status),
]);

const beadsByStatus: Record<string, Bead[]> = Object.fromEntries(
  DEFAULT_LANES.map((status) => [status, beads.filter((b) => b.status === status)]),
);

function setup(onSelect = vi.fn()) {
  const result = renderHook(() =>
    useKeyboardNavigation({
      beads,
      beadsByStatus,
      laneStatuses: DEFAULT_LANES,
      selectedId: null,
      onSelect,
      onOpen: vi.fn(),
      onClose: vi.fn(),
      searchInputRef: createRef<HTMLInputElement>(),
      isDetailOpen: false,
    }),
  );
  return { onSelect, ...result };
}

describe('columnShortcuts', () => {
  it('gives every lane its own g-prefix letter, first free letter of the status', () => {
    expect(columnShortcuts(DEFAULT_LANES)).toEqual({
      b: 'backlog',
      p: 'pending-approval',
      r: 'ready',
      a: 'active',
      c: 'acceptance',
      l: 'blocked',
      o: 'closed',
    });
  });

  it('leaves a lane without a shortcut when every letter of its status is taken', () => {
    expect(columnShortcuts(['ab', 'ba'])).toEqual({ a: 'ab', b: 'ba' });
    expect(columnShortcuts(['ab', 'ba', 'ab '])).toEqual({ a: 'ab', b: 'ba' });
  });
});

describe('useKeyboardNavigation across the derived lanes', () => {
  it('jumps to a lane past bd’s four native statuses', () => {
    const { onSelect, result } = setup();

    // Lane 4 of 7 is "active", reached with g then a.
    fireEvent.keyDown(window, { key: 'g' });
    fireEvent.keyDown(window, { key: 'a' });

    expect(result.current.selectedColumnStatus).toBe('active');
    expect(onSelect).toHaveBeenCalledWith(beadsByStatus.active[0]);
  });

  it('walks within a lane that is not one of bd’s native statuses', () => {
    const { onSelect, result } = setup();

    // Lane 3 of 7 is "ready".
    fireEvent.keyDown(window, { key: 'g' });
    fireEvent.keyDown(window, { key: 'r' });
    fireEvent.keyDown(window, { key: 'j' });

    expect(result.current.selectedId).toBe('ready-2');
    expect(onSelect).toHaveBeenLastCalledWith(beadsByStatus.ready[1]);
  });

  it('stays on the last card of a lane instead of leaving it', () => {
    const { result } = setup();

    fireEvent.keyDown(window, { key: 'g' });
    fireEvent.keyDown(window, { key: 'o' }); // the "closed" lane, last of seven
    fireEvent.keyDown(window, { key: 'j' });
    fireEvent.keyDown(window, { key: 'j' });

    expect(result.current.selectedColumnStatus).toBe('closed');
    expect(result.current.selectedId).toBe('closed-2');
  });

  it('starts from the first non-empty lane in lane order', () => {
    const onSelect = vi.fn();
    renderHook(() =>
      useKeyboardNavigation({
        beads: beadsByStatus.acceptance,
        beadsByStatus: { acceptance: beadsByStatus.acceptance },
        laneStatuses: DEFAULT_LANES,
        selectedId: null,
        onSelect,
        onOpen: vi.fn(),
        onClose: vi.fn(),
        searchInputRef: createRef<HTMLInputElement>(),
        isDetailOpen: false,
      }),
    );

    fireEvent.keyDown(window, { key: 'j' });

    expect(onSelect).toHaveBeenCalledWith(beadsByStatus.acceptance[0]);
  });
});
