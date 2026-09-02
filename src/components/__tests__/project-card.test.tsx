import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/api', () => ({
  fs: { openExternal: vi.fn() },
  projects: { update: vi.fn(), delete: vi.fn() },
  tags: { list: vi.fn(async () => []), create: vi.fn() },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// eslint-disable-next-line import/first, import/order
import { ProjectCard } from '../project-card';

function renderCard(props: Partial<React.ComponentProps<typeof ProjectCard>> = {}) {
  return render(
    <ProjectCard
      id="p1"
      name="livespec-console-beads-fabro"
      path="dolt://livespec_console_beads_fabro"
      tags={[]}
      countsLoaded
      {...props}
    />
  );
}

describe('ProjectCard per-status counts', () => {
  it('lists every raw lifecycle status with its count', () => {
    renderCard({
      beadCounts: { ready: 12, active: 3, 'pending-approval': 2, closed: 40 },
    });

    const list = screen.getByRole('list', { name: /counts by status/i });
    const entries = within(list).getAllByRole('listitem');

    expect(entries.map((li) => li.textContent)).toEqual([
      'Pending Approval2',
      'Ready12',
      'Active3',
      'Closed40',
    ]);
  });

  it('omits statuses with no beads', () => {
    renderCard({ beadCounts: { ready: 1, blocked: 0 } });

    const list = screen.getByRole('list', { name: /counts by status/i });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  });

  it('renders no counts list while counts are still loading', () => {
    renderCard({ beadCounts: {}, countsLoaded: false });

    expect(screen.queryByRole('list', { name: /counts by status/i })).toBeNull();
  });
});
