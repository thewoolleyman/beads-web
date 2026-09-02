import { describe, it, expect } from 'vitest';

import { unwrapHardBreaks } from '@/lib/markdown-unwrap';

describe('unwrapHardBreaks', () => {
  it('rejoins a paragraph an editor wrapped at 80 columns', () => {
    const input = [
      'A dispatcher-policy edit made from the console Settings view is accepted,',
      'persisted as a COMPLETED command AND a domain event, and then silently fails to',
      'take effect. The Settings pane re-renders the OLD value.',
    ].join('\n');

    expect(unwrapHardBreaks(input)).toBe(
      'A dispatcher-policy edit made from the console Settings view is accepted, ' +
        'persisted as a COMPLETED command AND a domain event, and then silently fails to ' +
        'take effect. The Settings pane re-renders the OLD value.',
    );
  });

  it('keeps a line break the author chose, between short lines', () => {
    const input = 'Live Settings view renders:\nWIP cap  [ 5 ]\nExpected  [ 6 ]';
    expect(unwrapHardBreaks(input)).toBe(input);
  });

  it('stops absorbing once a wrapped paragraph reaches its short last line', () => {
    const input = [
      'The console recorded a clean 5 -> 6 transition, marked the command completed,',
      'and emitted both domain events.',
      'WIP cap  [ 5 ]',
    ].join('\n');

    expect(unwrapHardBreaks(input)).toBe(
      'The console recorded a clean 5 -> 6 transition, marked the command completed, ' +
        'and emitted both domain events.\nWIP cap  [ 5 ]',
    );
  });

  it('respects an explicit Markdown hard break of two trailing spaces', () => {
    const input =
      'A dispatcher-policy edit made from the console Settings view is accepted,  \npersisted as a completed command.';
    expect(unwrapHardBreaks(input)).toBe(input);
  });

  it('leaves blank-line paragraph separation alone', () => {
    const input =
      'A dispatcher-policy edit made from the console Settings view is accepted here.\n\nSo the console recorded a clean transition.';
    expect(unwrapHardBreaks(input)).toBe(input);
  });

  it('never touches the inside of a fenced code block', () => {
    const input = [
      '```json',
      '{"repo":"livespec-console-beads-fabro","setting":"wip_cap","value":6,"note":"long"}',
      '{"event_count":2,"status":"completed","idempotency_key":"wip_cap=6","extra":"pad"}',
      '```',
    ].join('\n');
    expect(unwrapHardBreaks(input)).toBe(input);
  });

  it('does not pull a list item up into the paragraph above it', () => {
    const input = [
      'A dispatcher-policy edit made from the console Settings view is accepted here,',
      '- commands row: cmd_config_dispatcher_setting_set_wip_cap_6',
    ].join('\n');
    expect(unwrapHardBreaks(input)).toBe(input);
  });

  it('rejoins a list item that was itself wrapped', () => {
    const input = [
      '- The command row records type config.dispatcher_setting_set with status completed,',
      '  and an idempotency key of wip_cap=6.',
    ].join('\n');
    expect(unwrapHardBreaks(input)).toBe(
      '- The command row records type config.dispatcher_setting_set with status completed, ' +
        'and an idempotency key of wip_cap=6.',
    );
  });

  it('keeps a heading and the line under it apart', () => {
    const input = [
      '## Evidence (tenant livespec-console-beads-fabro, observed on 2026-07-20)',
      'Console store tmp/livespec-console.sqlite holds the completed command row.',
    ].join('\n');
    expect(unwrapHardBreaks(input)).toBe(input);
  });

  it('leaves an empty string untouched', () => {
    expect(unwrapHardBreaks('')).toBe('');
  });
});
