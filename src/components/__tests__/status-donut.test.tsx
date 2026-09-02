import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { StatusDonut } from '../status-donut';

/** Every `d` attribute rendered by the donut's svg paths. */
function pathData(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('path')).map(
    (p) => p.getAttribute('d') ?? ''
  );
}

describe('StatusDonut per-status segments', () => {
  it('renders one segment per non-zero raw status', () => {
    const { container } = render(
      <StatusDonut
        beadCounts={{ backlog: 4, ready: 12, active: 3, closed: 20 }}
        size={40}
      />
    );

    expect(pathData(container)).toHaveLength(4);
  });

  it('orders segments by lane order, not insertion order', () => {
    const { container } = render(
      <StatusDonut beadCounts={{ closed: 2, backlog: 1, active: 3 }} size={40} />
    );

    const order = Array.from(container.querySelectorAll('path')).map((p) =>
      p.getAttribute('data-status')
    );
    expect(order).toEqual(['backlog', 'active', 'closed']);
  });

  it('drops zero-count statuses from the segment set', () => {
    const { container } = render(
      <StatusDonut beadCounts={{ ready: 5, blocked: 0, closed: 1 }} size={40} />
    );

    const statuses = Array.from(container.querySelectorAll('path')).map((p) =>
      p.getAttribute('data-status')
    );
    expect(statuses).toEqual(['ready', 'closed']);
  });

  it('emits no NaN in any path geometry', () => {
    const { container } = render(
      <StatusDonut
        beadCounts={{
          backlog: 1,
          'pending-approval': 1,
          ready: 30,
          active: 2,
          acceptance: 1,
          blocked: 0,
          closed: 100,
        }}
        size={36}
      />
    );

    for (const d of pathData(container)) {
      expect(d).not.toContain('NaN');
      expect(d.length).toBeGreaterThan(0);
    }
  });

  it('renders the dashed placeholder rather than NaN paths when every count is zero', () => {
    const { container } = render(
      <StatusDonut beadCounts={{ ready: 0, closed: 0 }} size={40} />
    );

    expect(container.querySelectorAll('path')).toHaveLength(0);
    expect(container.querySelector('.border-dashed')).not.toBeNull();
  });

  it('survives a malformed count without emitting NaN', () => {
    const beadCounts = { ready: 3, closed: undefined } as unknown as Record<
      string,
      number
    >;
    const { container } = render(<StatusDonut beadCounts={beadCounts} size={40} />);

    for (const d of pathData(container)) {
      expect(d).not.toContain('NaN');
    }
  });

  it('renders no paths at all when the counts map is empty', () => {
    const { container } = render(<StatusDonut beadCounts={{}} size={40} />);

    expect(container.querySelectorAll('path')).toHaveLength(0);
  });
});
