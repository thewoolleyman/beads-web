"use client";

import { useCallback, useEffect, useMemo, useState, RefObject } from "react";

import type { Bead, BeadStatus } from "@/types";

/**
 * Build the 'g' prefix shortcuts for a board's lanes.
 *
 * The board's lanes come from the project's own status set, so the map
 * cannot be a fixed table. Each lane claims the first letter of its status
 * that no earlier lane has taken; a lane whose every letter is already
 * claimed simply has no shortcut.
 *
 * @param statuses - Raw lane statuses, in board order.
 * @returns Lowercase key → lane status.
 */
export function columnShortcuts(statuses: readonly string[]): Record<string, BeadStatus> {
  const shortcuts: Record<string, BeadStatus> = {};
  const claimed = new Set<string>();
  const seen = new Set<string>();

  for (const raw of statuses) {
    const status = raw.trim();
    if (!status || seen.has(status)) continue;
    seen.add(status);

    for (const char of status.toLowerCase()) {
      if (char < "a" || char > "z" || claimed.has(char)) continue;
      claimed.add(char);
      shortcuts[char] = status;
      break;
    }
  }

  return shortcuts;
}

export interface KeyboardNavigationOptions {
  beads: Bead[];
  beadsByStatus: Record<BeadStatus, Bead[]>;
  /** Board lane statuses, in board order — the column order for navigation. */
  laneStatuses: readonly string[];
  selectedId: string | null;
  onSelect: (bead: Bead) => void;
  onOpen: (bead: Bead) => void;
  onClose: () => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  isDetailOpen: boolean;
}

export interface KeyboardNavigationResult {
  selectedId: string | null;
  selectedColumnStatus: BeadStatus | null;
  setSelectedId: (id: string | null) => void;
  setSelectedColumnStatus: (status: BeadStatus | null) => void;
  scrollToSelected: () => void;
}

/**
 * Hook for keyboard navigation in the Kanban board
 *
 * Shortcuts:
 * - j or ArrowDown: Move selection down
 * - k or ArrowUp: Move selection up
 * - Enter: Open selected bead detail
 * - Escape: Close detail sheet / clear selection
 * - /: Focus search input
 * - g then a lane's letter: Go to that lane (see {@link columnShortcuts})
 */
export function useKeyboardNavigation({
  beads,
  beadsByStatus,
  laneStatuses,
  selectedId,
  onSelect,
  onOpen,
  onClose,
  searchInputRef,
  isDetailOpen,
}: KeyboardNavigationOptions): KeyboardNavigationResult {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(selectedId);
  const [selectedColumnStatus, setSelectedColumnStatus] = useState<BeadStatus | null>(null);
  const [awaitingColumnKey, setAwaitingColumnKey] = useState(false);

  // 'g' prefix shortcuts, one per lane the board actually renders
  const shortcuts = useMemo(() => columnShortcuts(laneStatuses), [laneStatuses]);

  // Sync internal state with external selectedId
  useEffect(() => {
    setInternalSelectedId(selectedId);
  }, [selectedId]);

  /**
   * Get the current column's beads for the selected bead
   */
  const getCurrentColumnBeads = useCallback((): Bead[] => {
    if (selectedColumnStatus) {
      return beadsByStatus[selectedColumnStatus] || [];
    }
    if (!internalSelectedId) {
      // Default to first non-empty column
      for (const status of laneStatuses) {
        if (beadsByStatus[status]?.length > 0) {
          return beadsByStatus[status];
        }
      }
      return [];
    }
    // Find which column contains the selected bead
    for (const status of laneStatuses) {
      const columnBeads = beadsByStatus[status] || [];
      if (columnBeads.some((b) => b.id === internalSelectedId)) {
        return columnBeads;
      }
    }
    return beads;
  }, [internalSelectedId, selectedColumnStatus, beadsByStatus, beads, laneStatuses]);

  /**
   * Get current index of selected bead in its column
   */
  const getCurrentIndex = useCallback((): number => {
    const columnBeads = getCurrentColumnBeads();
    if (!internalSelectedId) return -1;
    return columnBeads.findIndex((b) => b.id === internalSelectedId);
  }, [internalSelectedId, getCurrentColumnBeads]);

  /**
   * Move selection in a direction (up or down)
   */
  const moveSelection = useCallback(
    (direction: "up" | "down") => {
      const columnBeads = getCurrentColumnBeads();
      if (columnBeads.length === 0) return;

      const currentIndex = getCurrentIndex();
      let newIndex: number;

      if (currentIndex === -1) {
        // No selection, select first or last based on direction
        newIndex = direction === "down" ? 0 : columnBeads.length - 1;
      } else {
        newIndex =
          direction === "down"
            ? Math.min(currentIndex + 1, columnBeads.length - 1)
            : Math.max(currentIndex - 1, 0);
      }

      const newBead = columnBeads[newIndex];
      if (newBead) {
        setInternalSelectedId(newBead.id);
        onSelect(newBead);
        // Update column status based on selected bead
        for (const status of laneStatuses) {
          if (beadsByStatus[status]?.some((b) => b.id === newBead.id)) {
            setSelectedColumnStatus(status);
            break;
          }
        }
      }
    },
    [getCurrentColumnBeads, getCurrentIndex, onSelect, beadsByStatus, laneStatuses]
  );

  /**
   * Jump to a specific column
   */
  const jumpToColumn = useCallback(
    (status: BeadStatus) => {
      const columnBeads = beadsByStatus[status] || [];
      setSelectedColumnStatus(status);
      if (columnBeads.length > 0) {
        const firstBead = columnBeads[0];
        setInternalSelectedId(firstBead.id);
        onSelect(firstBead);
      } else {
        setInternalSelectedId(null);
      }
    },
    [beadsByStatus, onSelect]
  );

  /**
   * Scroll the selected bead into view
   */
  const scrollToSelected = useCallback(() => {
    if (!internalSelectedId) return;
    const element = document.querySelector(`[data-bead-id="${internalSelectedId}"]`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [internalSelectedId]);

  // Scroll into view when selection changes
  useEffect(() => {
    scrollToSelected();
  }, [internalSelectedId, scrollToSelected]);

  /**
   * Handle keyboard events
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle if focused on an input (except for Escape)
      const target = event.target as HTMLElement;
      const isInputFocused =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Always handle Escape
      if (event.key === "Escape") {
        event.preventDefault();
        if (isDetailOpen) {
          onClose();
        } else if (isInputFocused) {
          target.blur();
        } else if (internalSelectedId) {
          setInternalSelectedId(null);
          setSelectedColumnStatus(null);
        }
        setAwaitingColumnKey(false);
        return;
      }

      // Skip other shortcuts if in input
      if (isInputFocused) return;

      // Handle 'g' prefix for column navigation
      if (awaitingColumnKey) {
        setAwaitingColumnKey(false);
        const targetStatus = shortcuts[event.key.toLowerCase()];
        if (targetStatus) {
          event.preventDefault();
          jumpToColumn(targetStatus);
        }
        return;
      }

      switch (event.key) {
        case "j":
        case "ArrowDown":
          event.preventDefault();
          if (!isDetailOpen) {
            moveSelection("down");
          }
          break;

        case "k":
        case "ArrowUp":
          event.preventDefault();
          if (!isDetailOpen) {
            moveSelection("up");
          }
          break;

        case "Enter":
          event.preventDefault();
          if (internalSelectedId && !isDetailOpen) {
            const selectedBead = beads.find((b) => b.id === internalSelectedId);
            if (selectedBead) {
              onOpen(selectedBead);
            }
          }
          break;

        case "/":
          event.preventDefault();
          searchInputRef.current?.focus();
          break;

        case "g":
          event.preventDefault();
          setAwaitingColumnKey(true);
          // Reset after timeout if no follow-up key
          setTimeout(() => setAwaitingColumnKey(false), 1000);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    beads,
    internalSelectedId,
    isDetailOpen,
    awaitingColumnKey,
    moveSelection,
    jumpToColumn,
    shortcuts,
    onOpen,
    onClose,
    searchInputRef,
  ]);

  return {
    selectedId: internalSelectedId,
    selectedColumnStatus,
    setSelectedId: setInternalSelectedId,
    setSelectedColumnStatus,
    scrollToSelected,
  };
}
