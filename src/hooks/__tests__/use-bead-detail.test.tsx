import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import { beadHref } from '@/lib/bead-link';
import type { Bead } from '@/types';

import { useBeadDetail } from '../use-bead-detail';

/** Deliberately awkward so the test also pins percent-encoding. */
const PROJECT_ID = 'dolt://proj 1';

/** The bare project URL, with no item selected. */
const BOARD_URL = '/project?id=dolt%3A%2F%2Fproj%201';

function bead(id: string, title: string): Bead {
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
  };
}

const first = bead('bd-1', 'First item');
const second = bead('bd-2', 'Second item');
const beads = [first, second];

let replace: Mock<(href: string) => void>;

/** Render the hook over a fixed query string and a spied router. */
function renderDetail(query: string, initialBeads: Bead[] = beads) {
  const searchParams = new URLSearchParams(query);
  return renderHook(
    ({ loaded }: { loaded: Bead[] }) =>
      useBeadDetail(PROJECT_ID, loaded, { replace }, searchParams),
    { initialProps: { loaded: initialBeads } },
  );
}

beforeEach(() => {
  replace = vi.fn<(href: string) => void>();
});

describe('useBeadDetail deep-link sync', () => {
  it('opens the bead named by the bead query param', () => {
    const { result } = renderDetail('id=p1&bead=bd-2');

    expect(result.current.isDetailOpen).toBe(true);
    expect(result.current.detailBead?.id).toBe('bd-2');
  });

  it('waits for the beads to load before opening the deep-linked item', () => {
    const { result, rerender } = renderDetail('id=p1&bead=bd-2', []);

    expect(result.current.isDetailOpen).toBe(false);

    rerender({ loaded: beads });

    expect(result.current.isDetailOpen).toBe(true);
    expect(result.current.detailBead?.id).toBe('bd-2');
  });

  it('renders the board normally when the bead param names an unknown id', () => {
    const { result } = renderDetail('id=p1&bead=bd-nope');

    expect(result.current.isDetailOpen).toBe(false);
    expect(result.current.detailBead).toBeNull();
  });

  it('renders the board normally when there is no bead param', () => {
    const { result } = renderDetail('id=p1');

    expect(result.current.isDetailOpen).toBe(false);
    expect(result.current.detailBead).toBeNull();
  });

  it('does not reopen the deep-linked item after the user closes it', () => {
    const { result, rerender } = renderDetail('id=p1&bead=bd-2');

    act(() => result.current.handleDetailOpenChange(false));
    rerender({ loaded: beads });

    expect(result.current.isDetailOpen).toBe(false);
  });

  it('replaces the URL with the item deep link when an item is opened', () => {
    const { result } = renderDetail('id=p1');

    act(() => result.current.openBead(first));

    expect(result.current.detailBead?.id).toBe('bd-1');
    expect(replace).toHaveBeenCalledWith(beadHref(PROJECT_ID, 'bd-1'));
  });

  it('replaces the URL with the item deep link when navigating by id', () => {
    const { result } = renderDetail('id=p1');

    act(() => result.current.navigateToBead('bd-2'));

    expect(result.current.detailBead?.id).toBe('bd-2');
    expect(replace).toHaveBeenCalledWith(beadHref(PROJECT_ID, 'bd-2'));
  });

  it('drops the bead param from the URL when the detail is closed', () => {
    const { result } = renderDetail('id=p1');

    act(() => result.current.openBead(first));
    act(() => result.current.handleDetailOpenChange(false));

    expect(replace).toHaveBeenLastCalledWith(BOARD_URL);
  });
});
