import { describe, it, expect } from 'vitest';

import { beadHref, isModifiedClick } from '../bead-link';

/** A plain primary-button click with no modifier held. */
function click(overrides: Partial<Parameters<typeof isModifiedClick>[0]> = {}) {
  return { metaKey: false, ctrlKey: false, shiftKey: false, button: 0, ...overrides };
}

describe('beadHref', () => {
  it('addresses a bead by project id and bead id', () => {
    expect(beadHref('proj-1', 'bd-abc123')).toBe('/project?id=proj-1&bead=bd-abc123');
  });

  it('percent-encodes both ids', () => {
    expect(beadHref('dolt://a b', 'bd-1&2=3')).toBe(
      '/project?id=dolt%3A%2F%2Fa%20b&bead=bd-1%262%3D3',
    );
  });
});

describe('isModifiedClick', () => {
  it('is false for a plain left click', () => {
    expect(isModifiedClick(click())).toBe(false);
  });

  it('is true when Cmd is held', () => {
    expect(isModifiedClick(click({ metaKey: true }))).toBe(true);
  });

  it('is true when Ctrl is held', () => {
    expect(isModifiedClick(click({ ctrlKey: true }))).toBe(true);
  });

  it('is true when Shift is held', () => {
    expect(isModifiedClick(click({ shiftKey: true }))).toBe(true);
  });

  it('is true for a middle-click', () => {
    expect(isModifiedClick(click({ button: 1 }))).toBe(true);
  });

  it('tolerates a missing button, as on a keyboard-triggered click', () => {
    expect(isModifiedClick({ metaKey: false, ctrlKey: false, shiftKey: false })).toBe(false);
  });
});
