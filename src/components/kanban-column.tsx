"use client";

import { PackageOpen } from "lucide-react";

import { BeadCard } from "@/components/bead-card";
import { EpicCard } from "@/components/epic-card";
import { Badge } from "@/components/ui/badge";
import { laneAccent } from "@/lib/lanes";
import { cn } from "@/lib/utils";
import type { Bead, Epic } from "@/types";

export interface KanbanColumnProps {
  /** Raw status this lane holds. */
  status: string;
  title: string;
  beads: Bead[];
  /** All beads for resolving epic children */
  allBeads: Bead[];
  selectedBeadId?: string | null;
  ticketNumbers?: Map<string, number>;
  onSelectBead: (bead: Bead) => void;
  onChildClick?: (child: Bead) => void;
  onNavigateToDependency?: (beadId: string) => void;
  /** Project root path for fetching design docs */
  projectPath?: string;
  /** Callback after data changes (to refresh board) */
  onUpdate?: () => void;
}

/**
 * Type guard to check if a bead is an epic
 */
function isEpic(bead: Bead): bead is Epic {
  return bead.issue_type === 'epic';
}

/**
 * Reusable Kanban column component with header, count badge, and scrollable bead list
 * Renders EpicCard for epics and BeadCard for standalone tasks
 */
export function KanbanColumn({
  status,
  title,
  beads,
  allBeads,
  selectedBeadId,
  ticketNumbers,
  onSelectBead,
  onChildClick,
  onNavigateToDependency,
  projectPath,
  onUpdate,
}: KanbanColumnProps) {
  // Accent is resolved from the raw status, so any lifecycle gets a colour.
  const accent = laneAccent(status);
  const accentAlpha = (alpha: number) => `hsl(var(${accent.variable}) / ${alpha})`;

  return (
    <div
      className={cn(
        "flex flex-col h-full min-h-0 theme-column",
        "bg-surface-raised/30 border border-b-default/50"
      )}
      style={{ '--column-accent': accent.color } as React.CSSProperties}
    >
      {/* Column Header - fixed height with colored accent border */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-b-default/50 brutalist-column-header border-t-2"
        style={{ borderTopColor: accentAlpha(0.6) }}
      >
        <h2 className="font-semibold text-sm column-title-text" style={{ color: accent.color }}>{title}</h2>
        <Badge
          variant="secondary"
          className="text-xs px-2 py-0.5 column-count-badge"
          style={{
            backgroundColor: accentAlpha(0.2),
            borderColor: accentAlpha(0.3),
            color: accent.color,
          }}
        >
          {beads.length}
        </Badge>
      </div>

      {/* Scrollable Bead List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        <div className="space-y-3">
          {beads.map((bead) => {
            // Render EpicCard for epics, BeadCard for standalone tasks
            if (isEpic(bead)) {
              return (
                <EpicCard
                  key={bead.id}
                  epic={bead}
                  allBeads={allBeads}
                  ticketNumber={ticketNumbers?.get(bead.id)}
                  isSelected={selectedBeadId === bead.id}
                  onSelect={onSelectBead}
                  onChildClick={onChildClick ?? onSelectBead}
                  onNavigateToDependency={onNavigateToDependency}
                  projectPath={projectPath}
                  onUpdate={onUpdate}
                />
              );
            }

            return (
              <BeadCard
                key={bead.id}
                bead={bead}
                allBeads={allBeads}
                ticketNumber={ticketNumbers?.get(bead.id)}
                isSelected={selectedBeadId === bead.id}
                onSelect={onSelectBead}
              />
            );
          })}
          {beads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-b-strong/50 rounded-lg">
              <PackageOpen className="size-8 text-t-muted mb-2" aria-hidden="true" />
              <span className="text-t-muted text-sm">No beads</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
