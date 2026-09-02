/**
 * Per-item deep links.
 *
 * The app is a Next.js static export, so dynamic routes are unavailable and
 * an item's address has to live in query parameters. Every card links to its
 * item with a real `href`, which is what makes Cmd/Ctrl-click, middle-click
 * and "open in new tab" work through the browser instead of through us.
 */

/**
 * The subset of a mouse event that decides whether the browser, rather than
 * the app, should handle a click. Structurally satisfied by both
 * `React.MouseEvent` and the DOM `MouseEvent`.
 */
export interface ClickModifiers {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  /** 0 = primary, 1 = middle (auxiliary), 2 = secondary. */
  button?: number;
}

/** Canonical deep link for one bead in one project. */
export function beadHref(projectId: string, beadId: string): string {
  return `/project?id=${encodeURIComponent(projectId)}&bead=${encodeURIComponent(beadId)}`;
}

/**
 * True when the browser's own navigation should be left alone — a new tab,
 * a new window, or a middle-click.
 */
export function isModifiedClick(e: ClickModifiers): boolean {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1;
}
