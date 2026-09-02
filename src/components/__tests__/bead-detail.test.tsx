import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Bead } from '@/types';

import { BeadDetail } from '../bead-detail';

const bead: Bead = {
  id: 'bd-0123456789abcdef',
  title: 'Detail opens full-screen',
  status: 'open',
  priority: 1,
  issue_type: 'task',
  owner: 'maintainer',
  created_at: '2026-09-01T12:00:00Z',
  updated_at: '2026-09-01T12:00:00Z',
  comments: [],
};

const onOpenChange = vi.fn();

/**
 * Render the read-only detail (no projectPath) and return the modal panel:
 * the one fixed, scrollable container that holds the bead's content.
 */
function renderDetail() {
  const { container } = render(
    <BeadDetail bead={bead} open onOpenChange={onOpenChange} />
  );
  const panel = container.querySelector('div.fixed.overflow-y-auto');
  expect(panel).not.toBeNull();
  return panel as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BeadDetail full-screen modal', () => {
  it('renders the panel as a viewport-filling modal', () => {
    const panel = renderDetail();

    expect(panel).toHaveClass('fixed');
    expect(panel).toHaveClass('inset-0');
    expect(panel).toHaveClass('md:inset-[2.5vh_2.5vw]');
    expect(panel).toHaveClass('w-auto');
    expect(panel).toHaveClass('max-w-none');
    expect(panel).toHaveClass('z-50');
  });

  it('does not constrain the panel to a right-hand sliver', () => {
    const panel = renderDetail();

    expect(panel.className).not.toContain('max-w-lg');
    expect(panel.className).not.toContain('max-w-xl');
    expect(panel.className).not.toContain('right-0');
    expect(panel.className).not.toContain('translate-x');
  });

  it('scrolls long content inside the modal', () => {
    const panel = renderDetail();

    expect(panel).toHaveClass('overflow-y-auto');
  });

  it('keeps a header with the id, title and close control pinned while scrolling', () => {
    const panel = renderDetail();

    const header = panel.querySelector('.sticky');
    expect(header).not.toBeNull();
    expect(header).toHaveClass('top-0');
    expect(header).toContainElement(screen.getByRole('button', { name: 'Close' }));
    expect(header).toHaveTextContent('Detail opens full-screen');
    expect(header).toHaveTextContent('BD-01234567');
  });

  it('closes when Escape is pressed while open', () => {
    renderDetail();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('ignores Escape when the panel is closed', () => {
    render(<BeadDetail bead={bead} open={false} onOpenChange={onOpenChange} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('closes when the close control is clicked', () => {
    renderDetail();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
