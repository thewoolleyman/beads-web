"use client";

/**
 * Hook for loading ONE bead's comments for the detail panel.
 *
 * The board list (`/api/beads`) carries only `comment_count`; full comment
 * bodies are read from `/api/beads/comments` when a bead opens, whether it was
 * clicked on the board or opened from a `?bead=` deep link.
 */

import { useState, useEffect, useCallback, useRef } from "react";

import * as api from "@/lib/api";
import type { Comment } from "@/types";

export interface UseBeadCommentsResult {
  /** The bead's comments, oldest first (empty until the first load lands) */
  comments: Comment[];
  /** True while a load for the current bead is in flight and none has landed */
  isLoading: boolean;
  /** The last load's error, if it failed */
  error: Error | null;
  /** Re-read the comments (e.g. after adding one) */
  refetch: () => Promise<void>;
}

/**
 * Loads the comments of `beadId` in `projectPath`.
 *
 * @param projectPath - Project path (or `dolt://db`) the bead belongs to
 * @param beadId - The open bead, or null when no bead is open
 * @param version - Any value that changes when the bead's comments may have
 *   changed (its `comment_count` and `updated_at`); a change re-reads them
 */
export function useBeadComments(
  projectPath: string,
  beadId: string | null,
  version?: string | number,
): UseBeadCommentsResult {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  /** Monotonic request id so a slow response for an old bead is dropped. */
  const requestRef = useRef(0);

  const key = projectPath && beadId ? `${projectPath}\u0000${beadId}` : null;

  const load = useCallback(async () => {
    if (!projectPath || !beadId) return;
    const request = ++requestRef.current;
    setIsFetching(true);
    setError(null);
    try {
      const next = await api.beads.comments(projectPath, beadId);
      if (request !== requestRef.current) return;
      setComments(next);
      setLoadedFor(`${projectPath}\u0000${beadId}`);
      setError(null);
    } catch (err) {
      if (request !== requestRef.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (request === requestRef.current) setIsFetching(false);
    }
  }, [projectPath, beadId]);

  useEffect(() => {
    void load();
  }, [load, version]);

  const isCurrent = key !== null && loadedFor === key;

  return {
    comments: isCurrent ? comments : [],
    isLoading: key !== null && !isCurrent && (isFetching || error === null),
    error,
    refetch: load,
  };
}
