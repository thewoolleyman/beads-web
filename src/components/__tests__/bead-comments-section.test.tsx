import { render, screen, waitFor, fireEvent, renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useBeadDetail } from '@/hooks/use-bead-detail';
import type { Bead, Comment } from '@/types';

import { BeadCommentsSection } from '../bead-comments-section';

const apiMock = vi.hoisted(() => ({
  comments: vi.fn<(path: string, id: string) => Promise<Comment[]>>(),
}));

vi.mock('@/lib/api', () => ({
  beads: { comments: apiMock.comments },
}));

const addCommentMock = vi.hoisted(() => vi.fn<(id: string, text: string, path: string) => Promise<void>>());

vi.mock('@/lib/cli', () => ({
  addComment: addCommentMock,
}));

const PROJECT_PATH = '/data/projects/tenant';

function listBead(id: string, extra: Partial<Bead> = {}): Bead {
  return {
    id,
    title: `Item ${id}`,
    status: 'ready',
    priority: 2,
    issue_type: 'task',
    owner: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    comment_count: 2,
    ...extra,
  };
}

function comment(id: string, issueId: string, text: string): Comment {
  return { id, issue_id: issueId, author: 'maintainer', text, created_at: '2026-01-02T00:00:00Z' };
}

/** A promise the test resolves by hand, to observe the loading state. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

beforeEach(() => {
  apiMock.comments.mockReset();
  addCommentMock.mockReset();
});

describe('BeadCommentsSection', () => {
  it('shows a loading state, then the comments fetched for the open bead', async () => {
    const pending = deferred<Comment[]>();
    apiMock.comments.mockReturnValue(pending.promise);
    const bead = listBead('bd-1');

    render(<BeadCommentsSection bead={bead} projectPath={PROJECT_PATH} childBeads={[]} />);

    expect(screen.getByText('Loading comments…')).toBeInTheDocument();
    expect(apiMock.comments).toHaveBeenCalledWith(PROJECT_PATH, 'bd-1');

    pending.resolve([comment('c1', 'bd-1', 'First note'), comment('c2', 'bd-1', 'Second note')]);

    expect(await screen.findByText('First note')).toBeInTheDocument();
    expect(screen.getByText('Second note')).toBeInTheDocument();
    expect(screen.getByText('Comments (2)')).toBeInTheDocument();
    expect(screen.queryByText('Loading comments…')).not.toBeInTheDocument();
  });

  it('reports a failed fetch instead of loading forever', async () => {
    apiMock.comments.mockRejectedValue(new Error('API error: 500 boom'));

    render(<BeadCommentsSection bead={listBead('bd-1')} projectPath={PROJECT_PATH} childBeads={[]} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('API error: 500 boom');
    expect(screen.queryByText('Loading comments…')).not.toBeInTheDocument();
  });

  it('re-reads the comments when the open bead changes', async () => {
    apiMock.comments.mockImplementation(async (_path, id) => [comment(`c-${id}`, id, `Note on ${id}`)]);

    const { rerender } = render(
      <BeadCommentsSection bead={listBead('bd-1')} projectPath={PROJECT_PATH} childBeads={[]} />,
    );
    expect(await screen.findByText('Note on bd-1')).toBeInTheDocument();

    rerender(<BeadCommentsSection bead={listBead('bd-2')} projectPath={PROJECT_PATH} childBeads={[]} />);

    expect(await screen.findByText('Note on bd-2')).toBeInTheDocument();
    expect(screen.queryByText('Note on bd-1')).not.toBeInTheDocument();
    expect(apiMock.comments).toHaveBeenLastCalledWith(PROJECT_PATH, 'bd-2');
  });

  it('re-reads the comments after one is added', async () => {
    apiMock.comments.mockResolvedValueOnce([]).mockResolvedValueOnce([comment('c1', 'bd-1', 'Just added')]);
    addCommentMock.mockResolvedValue(undefined);
    const onCommentAdded = vi.fn();

    render(
      <BeadCommentsSection
        bead={listBead('bd-1', { comment_count: 0 })}
        projectPath={PROJECT_PATH}
        childBeads={[]}
        onCommentAdded={onCommentAdded}
      />,
    );
    expect(await screen.findByText('No comments yet')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Add a comment'), { target: { value: 'Just added' } });
    fireEvent.keyDown(screen.getByLabelText('Add a comment'), { key: 'Enter' });

    expect(await screen.findByText('Just added', { selector: 'p' })).toBeInTheDocument();
    expect(apiMock.comments).toHaveBeenCalledTimes(2);
    expect(onCommentAdded).toHaveBeenCalled();
  });

  it('fetches the comments of a bead opened from the bead= URL parameter', async () => {
    apiMock.comments.mockResolvedValue([comment('c9', 'bd-deep', 'Deep-linked note')]);
    const beads = [listBead('bd-other'), listBead('bd-deep')];

    // The board resolves the open bead from `?bead=` exactly like this.
    const { result } = renderHook(() =>
      useBeadDetail('p1', beads, { replace: vi.fn() }, new URLSearchParams('id=p1&bead=bd-deep')),
    );
    const detailBead = result.current.detailBead;
    expect(detailBead?.id).toBe('bd-deep');

    render(<BeadCommentsSection bead={detailBead!} projectPath={PROJECT_PATH} childBeads={[]} />);

    expect(await screen.findByText('Deep-linked note')).toBeInTheDocument();
    expect(apiMock.comments).toHaveBeenCalledWith(PROJECT_PATH, 'bd-deep');
    await waitFor(() => expect(apiMock.comments).toHaveBeenCalledTimes(1));
  });
});
