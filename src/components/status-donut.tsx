"use client";

import { useMemo, useState } from "react";

import { humanizeStatus, laneAccent, orderStatuses } from "@/lib/lanes";
import type { BeadCounts } from "@/types";

interface StatusDonutProps {
  /**
   * Bead counts keyed by raw status. Statuses are free-form per-tenant
   * lifecycle strings, so the donut renders one segment per status
   * present rather than bd's four native statuses.
   */
  beadCounts: BeadCounts;
  size?: number;
  className?: string;
  /**
   * When `false`, renders a dashed/outline placeholder donut regardless
   * of the numeric counts. Used on the home page to signal "counts are
   * still loading from the backend, no cached value yet" without
   * showing a misleading "0 tasks" state.
   */
  countsLoaded?: boolean;
}

/** One donut segment: a raw status, its count, and its lane accent. */
interface Segment {
  status: string;
  title: string;
  count: number;
  fill: string;
}

/**
 * Turn a counts map into ordered, renderable segments.
 *
 * Counts arriving over the wire are untrusted: a missing or non-numeric
 * value must never reach the geometry maths, or every path `d` becomes
 * `M NaN NaN …`. Non-finite and non-positive counts are dropped here.
 */
export function toSegments(beadCounts: BeadCounts): Segment[] {
  const counts = beadCounts ?? {};
  const usable = Object.keys(counts).filter((status) => {
    const count = counts[status];
    return typeof count === "number" && Number.isFinite(count) && count > 0;
  });

  return orderStatuses(usable).map((status) => ({
    status,
    title: humanizeStatus(status),
    count: counts[status],
    fill: laneAccent(status).color,
  }));
}

// Custom tooltip showing every status present
function StatusTooltip({ segments, total }: { segments: Segment[]; total: number }) {
  return (
    <div className="rounded-lg border border-b-strong bg-surface-raised px-3 py-2 shadow-lg">
      <div className="mb-1.5 text-xs font-medium text-t-secondary">
        {total} task{total !== 1 ? "s" : ""}
      </div>
      <div className="space-y-1">
        {segments.map((segment) => (
          <div key={segment.status} className="flex items-center gap-2 text-xs">
            <div className="h-2 w-2 rounded-sm" style={{ backgroundColor: segment.fill }} />
            <span className="text-t-tertiary">{segment.title}</span>
            <span className="ml-auto font-mono text-t-primary">{segment.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatusDonut({ beadCounts, size = 40, className, countsLoaded = true }: StatusDonutProps) {
  const [isHovered, setIsHovered] = useState(false);

  const segments = useMemo(() => toSegments(beadCounts), [beadCounts]);

  const total = useMemo(
    () => segments.reduce((sum, segment) => sum + segment.count, 0),
    [segments]
  );

  // Dashed placeholder when counts haven't loaded yet, OR when the
  // project genuinely has no tasks. Same visual — the former resolves
  // to a solid donut on its own once `countsLoaded` flips to true, the
  // latter stays dashed indefinitely which is correct semantics.
  //
  // `total` cannot be NaN here: `toSegments` drops every non-finite
  // count, so a malformed payload lands in this branch instead of
  // producing `M NaN NaN` path geometry.
  if (!countsLoaded || total <= 0) {
    const label = !countsLoaded ? "Loading tasks" : "No tasks";
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
        aria-label={label}
        aria-busy={!countsLoaded}
      >
        <div
          className="rounded-full border-2 border-dashed border-b-strong w-full h-full"
          title={label}
        />
      </div>
    );
  }

  const innerRadius = size * 0.32;
  const outerRadius = size * 0.48;
  // Only add padding between segments when there is more than one.
  const paddingAngle = segments.length > 1 ? 3 : 0;

  return (
    <div
      className={`relative ${className || ""}`}
      style={{ width: size, height: size }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`translate(${size / 2}, ${size / 2})`}>
          {/* Render pie segments */}
          {segments.map((entry, index) => {
            // Calculate angles for each segment
            const startAngle = segments
              .slice(0, index)
              .reduce((acc, d) => acc + (d.count / total) * 360, 0);
            const segmentAngle = (entry.count / total) * 360;
            const endAngle = startAngle + segmentAngle;

            // Check if this is a full circle (single segment covering 100%)
            const isFullCircle = segments.length === 1;

            if (isFullCircle) {
              // For full circle, use two semicircular arcs
              // This avoids the issue where start and end points are the same
              return (
                <g key={entry.status}>
                  {/* First semicircle (top half) */}
                  <path
                    data-status={entry.status}
                    d={`M 0 ${-outerRadius} A ${outerRadius} ${outerRadius} 0 0 1 0 ${outerRadius} L 0 ${innerRadius} A ${innerRadius} ${innerRadius} 0 0 0 0 ${-innerRadius} Z`}
                    fill={entry.fill}
                  />
                  {/* Second semicircle (bottom half) */}
                  <path
                    data-status={entry.status}
                    d={`M 0 ${outerRadius} A ${outerRadius} ${outerRadius} 0 0 1 0 ${-outerRadius} L 0 ${-innerRadius} A ${innerRadius} ${innerRadius} 0 0 0 0 ${innerRadius} Z`}
                    fill={entry.fill}
                  />
                </g>
              );
            }

            // Gap between segments, never wide enough to invert a thin
            // slice into a negative sweep.
            const pad = Math.min(paddingAngle, segmentAngle * 0.5);
            const adjustedStart = startAngle + pad / 2;
            const adjustedEnd = endAngle - pad / 2;

            // Convert to radians (SVG uses radians, start from top)
            const startRad = ((adjustedStart - 90) * Math.PI) / 180;
            const endRad = ((adjustedEnd - 90) * Math.PI) / 180;

            // Calculate arc path
            const x1 = Math.cos(startRad) * outerRadius;
            const y1 = Math.sin(startRad) * outerRadius;
            const x2 = Math.cos(endRad) * outerRadius;
            const y2 = Math.sin(endRad) * outerRadius;
            const x3 = Math.cos(endRad) * innerRadius;
            const y3 = Math.sin(endRad) * innerRadius;
            const x4 = Math.cos(startRad) * innerRadius;
            const y4 = Math.sin(startRad) * innerRadius;

            const largeArcFlag = adjustedEnd - adjustedStart > 180 ? 1 : 0;

            const d = [
              `M ${x1} ${y1}`,
              `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
              `L ${x3} ${y3}`,
              `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
              "Z",
            ].join(" ");

            return (
              <path
                key={entry.status}
                data-status={entry.status}
                d={d}
                fill={entry.fill}
              />
            );
          })}
          {/* Invisible circle covering entire donut area for hover detection */}
          <circle
            r={outerRadius}
            fill="transparent"
            style={{ cursor: "default" }}
          />
        </g>
      </svg>

      {/* Tooltip - shown on hover anywhere in the donut area */}
      {isHovered && (
        <div className="absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap">
          <StatusTooltip segments={segments} total={total} />
        </div>
      )}
    </div>
  );
}
