import { describe, it, expect } from 'vitest';

import { DEFAULT_LANES, deriveLanes, laneAccent } from '@/lib/lanes';

/** Minimal shape deriveLanes needs — full Bead objects are not required. */
function withStatus(...statuses: string[]): { status: string }[] {
  return statuses.map((status) => ({ status }));
}

describe('DEFAULT_LANES', () => {
  it('is the livespec lifecycle order', () => {
    expect(DEFAULT_LANES).toEqual([
      'backlog',
      'pending-approval',
      'ready',
      'active',
      'acceptance',
      'blocked',
      'closed',
    ]);
  });
});

describe('deriveLanes', () => {
  it('renders every configured lane even when no bead carries that status', () => {
    const lanes = deriveLanes([]);
    expect(lanes.map((l) => l.status)).toEqual([...DEFAULT_LANES]);
  });

  it('appends statuses absent from the configured list in first-seen order', () => {
    const beads = withStatus('ready', 'triage', 'closed', 'wontfix', 'triage');
    const lanes = deriveLanes(beads);
    expect(lanes.map((l) => l.status)).toEqual([
      ...DEFAULT_LANES,
      'triage',
      'wontfix',
    ]);
  });

  it('never duplicates a lane', () => {
    const beads = withStatus('active', 'active', 'triage', 'triage');
    const statuses = deriveLanes(beads).map((l) => l.status);
    expect(new Set(statuses).size).toBe(statuses.length);
  });

  it('drops tombstone beads from the lane set', () => {
    const beads = withStatus('active', 'tombstone');
    expect(deriveLanes(beads).map((l) => l.status)).not.toContain('tombstone');
  });

  it('ignores blank statuses', () => {
    const beads = withStatus('active', '', '   ');
    expect(deriveLanes(beads).map((l) => l.status)).toEqual([...DEFAULT_LANES]);
  });

  it('honours a caller-supplied lane order', () => {
    const beads = withStatus('done', 'todo', 'extra');
    const lanes = deriveLanes(beads, ['todo', 'done']);
    expect(lanes.map((l) => l.status)).toEqual(['todo', 'done', 'extra']);
  });

  it('humanizes the lane title', () => {
    const lanes = deriveLanes(withStatus('in_progress', 'pending-approval'));
    const titles = new Map(lanes.map((l) => [l.status, l.title]));
    expect(titles.get('pending-approval')).toBe('Pending Approval');
    expect(titles.get('in_progress')).toBe('In Progress');
    expect(titles.get('ready')).toBe('Ready');
    expect(titles.get('backlog')).toBe('Backlog');
  });
});

describe('laneAccent', () => {
  it('gives each livespec lane a distinct accent token', () => {
    const variables = DEFAULT_LANES.map((status) => laneAccent(status).variable);
    expect(new Set(variables).size).toBe(DEFAULT_LANES.length);
  });

  it('keeps the stock bd column colours', () => {
    expect(laneAccent('open').variable).toBe('--status-open');
    expect(laneAccent('in_progress').variable).toBe('--status-progress');
    expect(laneAccent('inreview').variable).toBe('--status-review');
    expect(laneAccent('closed').variable).toBe('--status-closed');
  });

  it('falls back to a neutral accent for an unrecognised status', () => {
    const accent = laneAccent('triage');
    expect(accent.variable).toBe('--text-muted');
    expect(accent.color).toBe('hsl(var(--text-muted))');
  });

  it('exposes the accent as a ready-to-use CSS colour', () => {
    expect(laneAccent('active').color).toBe(`hsl(var(${laneAccent('active').variable}))`);
  });
});
