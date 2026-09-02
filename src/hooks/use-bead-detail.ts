"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";

import { beadHref } from "@/lib/bead-link";
import type { Bead } from "@/types";

/** The slice of the Next router this hook needs: history replacement only. */
export interface DetailRouter {
  replace: (href: string) => void;
}

/** The slice of the URL query this hook reads. */
export interface DetailSearchParams {
  get: (key: string) => string | null;
}

export interface UseBeadDetailResult {
  /** The currently selected bead (resolved from allBeads) */
  detailBead: Bead | null;
  /** Whether the detail panel is open */
  isDetailOpen: boolean;
  /** Open detail for a bead */
  openBead: (bead: Bead) => void;
  /** Handle detail panel open/close */
  handleDetailOpenChange: (open: boolean) => void;
  /** Navigate to a bead by ID (for dependencies, memory panel, etc.) */
  navigateToBead: (beadId: string) => void;
}

/**
 * Manages bead detail panel state and keeps it in step with the URL.
 *
 * The open item lives in the address bar as `?bead=<id>` so that every item
 * has a copy-pasteable link. The param is applied once, as soon as the
 * project's beads have loaded: after that the user's own open and close
 * actions drive the URL, not the other way round, so closing an item the
 * link pointed at does not immediately reopen it.
 *
 * @param projectId - Project whose board is showing, or null before it resolves
 * @param allBeads - All beads array (used to resolve bead by ID)
 * @param router - Router used to replace (never push) the current URL
 * @param searchParams - Current query string
 */
export function useBeadDetail(
  projectId: string | null,
  allBeads: Bead[],
  router: DetailRouter,
  searchParams: DetailSearchParams,
): UseBeadDetailResult {
  const [detailBeadId, setDetailBeadId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const detailBead = useMemo(() => {
    if (!detailBeadId) return null;
    return allBeads.find((b) => b.id === detailBeadId) || null;
  }, [detailBeadId, allBeads]);

  /** Replace the URL, keeping the board addressable. No-op without a project. */
  const showInUrl = useCallback((beadId: string | null) => {
    if (!projectId) return;
    router.replace(
      beadId ? beadHref(projectId, beadId) : `/project?id=${encodeURIComponent(projectId)}`,
    );
  }, [projectId, router]);

  // Apply the incoming ?bead= exactly once, on the first render that has beads.
  const deepLinkApplied = useRef(false);
  const linkedBeadId = searchParams.get("bead");

  useEffect(() => {
    if (deepLinkApplied.current || allBeads.length === 0) return;
    deepLinkApplied.current = true;

    if (!linkedBeadId) return;
    const found = allBeads.find((b) => b.id === linkedBeadId);
    if (!found) return;

    setDetailBeadId(found.id);
    setIsDetailOpen(true);
  }, [allBeads, linkedBeadId]);

  const openBead = useCallback((bead: Bead) => {
    deepLinkApplied.current = true;
    setDetailBeadId(bead.id);
    setIsDetailOpen(true);
    showInUrl(bead.id);
  }, [showInUrl]);

  const handleDetailOpenChange = useCallback((open: boolean) => {
    deepLinkApplied.current = true;
    setIsDetailOpen(open);
    if (!open) {
      setDetailBeadId(null);
      showInUrl(null);
    }
  }, [showInUrl]);

  const navigateToBead = useCallback((beadId: string) => {
    const found = allBeads.find((b) => b.id === beadId);
    if (found) {
      deepLinkApplied.current = true;
      setDetailBeadId(found.id);
      setIsDetailOpen(true);
      showInUrl(found.id);
    }
  }, [allBeads, showInUrl]);

  return {
    detailBead,
    isDetailOpen,
    openBead,
    handleDetailOpenChange,
    navigateToBead,
  };
}
