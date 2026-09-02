/**
 * Kanban lanes derived from a project's real status set.
 *
 * Beads carries a free-form `status` string per issue, and different
 * tenants use different lifecycles. Rather than remapping unknown
 * statuses onto bd's four native columns, the board renders one lane per
 * status in the ordered union of a configured lane list and every status
 * actually present in the data.
 */

/** A single kanban lane. */
export interface Lane {
  /** Raw status string, exactly as it appears on the beads. */
  status: string;
  /** Human-readable column heading. */
  title: string;
}

/** Colour accent for a lane, expressed as theme CSS custom properties. */
export interface LaneAccent {
  /** Custom property holding an `H S% L%` triple, e.g. `--status-open`. */
  variable: string;
  /** Ready-to-use CSS colour built from {@link LaneAccent.variable}. */
  color: string;
}

/**
 * Default lane order: the livespec lifecycle used by the family's beads
 * tenants. Statuses found in the data but missing here still get a lane,
 * appended after these.
 */
export const DEFAULT_LANES: string[] = [
  'backlog',
  'pending-approval',
  'ready',
  'active',
  'acceptance',
  'blocked',
  'closed',
];

/** Statuses that never get a lane. */
const HIDDEN_STATUSES = new Set(['tombstone']);

/** Neutral accent used for any status without an explicit colour. */
const NEUTRAL_ACCENT_VARIABLE = '--text-muted';

/**
 * Accent tokens per known status. Values are theme custom properties, so
 * every theme's overrides apply without a per-status Tailwind class.
 */
const ACCENT_VARIABLES: Record<string, string> = {
  // livespec lifecycle
  backlog: '--text-tertiary',
  'pending-approval': '--epic',
  ready: '--status-open',
  active: '--status-progress',
  acceptance: '--status-review',
  blocked: '--blocked-accent',
  closed: '--status-closed',
  // bd's native statuses
  open: '--status-open',
  in_progress: '--status-progress',
  inreview: '--status-review',
  // common synonyms
  done: '--status-closed',
  resolved: '--status-closed',
  pending: '--epic',
  deferred: '--text-faint',
  hooked: '--status-progress',
};

/** Turn a raw status into a human-readable lane title. */
export function humanizeStatus(status: string): string {
  return status
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Derive the ordered lane set for a board: every configured lane first,
 * in the configured order, then every other status present in the beads
 * in first-seen order. Raw statuses are never remapped; `tombstone` and
 * blank statuses are dropped.
 */
export function deriveLanes(
  beads: readonly { status: string }[],
  configured: readonly string[] = DEFAULT_LANES,
): Lane[] {
  const ordered: string[] = [];
  const seen = new Set<string>();

  const add = (raw: string | undefined | null) => {
    const status = (raw ?? '').trim();
    if (!status || seen.has(status) || HIDDEN_STATUSES.has(status)) return;
    seen.add(status);
    ordered.push(status);
  };

  for (const status of configured) add(status);
  for (const bead of beads) add(bead.status);

  return ordered.map((status) => ({ status, title: humanizeStatus(status) }));
}

/**
 * Order a set of raw statuses the way the board orders its lanes:
 * configured lanes first in the configured order, then every other
 * status in first-seen order.
 *
 * Unlike {@link deriveLanes}, this returns *only* statuses that actually
 * appear in the input. Use it wherever a surface enumerates the statuses
 * present in some data (donut segments, per-status count rows) rather
 * than rendering a fixed lane set.
 */
export function orderStatuses(
  statuses: readonly string[],
  configured: readonly string[] = DEFAULT_LANES,
): string[] {
  const present: string[] = [];
  const seen = new Set<string>();
  for (const raw of statuses) {
    const status = (raw ?? '').trim();
    if (!status || seen.has(status) || HIDDEN_STATUSES.has(status)) continue;
    seen.add(status);
    present.push(status);
  }

  const configuredSet = new Set(configured);
  return [
    ...configured.filter((status) => seen.has(status)),
    ...present.filter((status) => !configuredSet.has(status)),
  ];
}

/**
 * Resolve the colour accent for a lane, falling back to a neutral tone
 * for statuses the palette does not know about.
 */
export function laneAccent(status: string): LaneAccent {
  const variable = ACCENT_VARIABLES[status] ?? NEUTRAL_ACCENT_VARIABLE;
  return { variable, color: `hsl(var(${variable}))` };
}
