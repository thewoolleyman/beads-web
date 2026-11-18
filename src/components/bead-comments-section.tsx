"use client";

import { ActivityTimeline } from "@/components/activity-timeline";
import { CommentList } from "@/components/comment-list";
import { useBeadComments } from "@/hooks/use-bead-comments";
import type { Bead } from "@/types";

export interface BeadCommentsSectionProps {
  bead: Bead;
  projectPath: string;
  childBeads: Bead[];
  /** Called after a comment is added, so the board can refresh its counts */
  onCommentAdded?: () => void;
}

/**
 * The comments and activity timeline of the open bead.
 *
 * Fetches the bead's comments from `/api/beads/comments` when it opens (the
 * board list carries only `comment_count`) and shows a loading state until
 * they arrive.
 */
export function BeadCommentsSection({
  bead,
  projectPath,
  childBeads,
  onCommentAdded,
}: BeadCommentsSectionProps) {
  const { comments, isLoading, error, refetch } = useBeadComments(
    projectPath,
    bead.id,
    `${bead.comment_count ?? ""}|${bead.updated_at ?? ""}`,
  );

  if (isLoading) {
    return (
      <div role="status" aria-live="polite" className="space-y-4">
        <h3 className="font-semibold text-sm">
          Comments{bead.comment_count != null ? ` (${bead.comment_count})` : ""}
        </h3>
        <div className="border-t" />
        <p className="text-sm text-t-muted py-4 text-center">Loading comments…</p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <p role="alert" className="text-sm text-danger">
          Failed to load comments: {error.message}
        </p>
      )}
      <CommentList
        comments={comments}
        beadId={bead.id}
        projectPath={projectPath}
        onCommentAdded={() => {
          void refetch();
          onCommentAdded?.();
        }}
      />
      <ActivityTimeline bead={bead} comments={comments} childBeads={childBeads} />
    </>
  );
}
