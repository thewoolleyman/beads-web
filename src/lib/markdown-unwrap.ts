/**
 * Rejoin editor hard-wrapped lines so Markdown reflows to its container.
 *
 * `MarkdownBody` renders with `remark-breaks`, which turns every single
 * newline into a `<br>`. That is what lets a deliberately broken line
 * (`WIP cap  [ 5 ]` under the line naming it) render on a line of its own.
 * It also means a description its author wrapped at 80 columns in an editor
 * keeps that 80-column ragged edge forever — about a third of a full-screen
 * detail panel, with the rest left blank.
 *
 * The two cases are distinguishable. A line that ran all the way out to the
 * wrap column was broken by the editor; a short line was broken on purpose.
 * So a newline is dissolved only when the line before it is long enough to
 * have been wrapped and the line after it continues the same block.
 */

/**
 * Minimum length for a line to look editor-wrapped rather than deliberate.
 * Common wrap columns are 72, 79, 80 and 100. Deliberate short lines in bead
 * fields — labels, pseudo-renders, one-line facts — sit well under this.
 */
const WRAP_COLUMN_FLOOR = 60;

/** Opens or closes a fenced code block. */
const FENCE = /^ {0,3}(?:```|~~~)/;

/**
 * A line that owns its own break: headings, table rows, HTML, thematic
 * breaks and setext underlines never absorb the line beneath them.
 */
const OWNS_ITS_BREAK =
  /^ {0,3}(?:#{1,6}\s|\||<|(?:[-*_] *){3,}$|(?:=+|-+) *$)/;

/** Starts a new block, so the newline before it is structure, not wrapping. */
const STARTS_BLOCK =
  /^ {0,3}(?:#{1,6}\s|>|[-*+]\s|\d+[.)]\s|\||```|~~~|<|(?:[-*_] *){3,}$|(?:=+|-+) *$)/;

/** Two or more trailing spaces, or a trailing backslash: an explicit break. */
const EXPLICIT_BREAK = /(?: {2,}|\\)$/;

/** An indented code block, which keeps every line break it was given. */
const INDENTED_CODE = /^ {4,}\S/;

/** Whether this line looks like one an editor wrapped mid-sentence. */
function looksWrapped(line: string): boolean {
  if (EXPLICIT_BREAK.test(line)) return false;
  const trimmed = line.trimEnd();
  if (trimmed.length < WRAP_COLUMN_FLOOR) return false;
  return !OWNS_ITS_BREAK.test(trimmed);
}

/** Whether this line is the continuation of the block above it. */
function continuesBlock(line: string): boolean {
  if (line.trim() === "") return false;
  if (INDENTED_CODE.test(line)) return false;
  return !STARTS_BLOCK.test(line);
}

/**
 * Join lines that an editor hard-wrapped, leaving every deliberate line
 * break, blank line, list, heading and code block exactly as written.
 */
export function unwrapHardBreaks(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inFence = false;
  // Tracks the ORIGINAL line last emitted, not the accumulated join, so a
  // wrapped paragraph stops absorbing at its own short final line.
  let previousWasWrapped = false;

  for (const line of lines) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      out.push(line);
      previousWasWrapped = false;
      continue;
    }

    if (!inFence && previousWasWrapped && continuesBlock(line)) {
      out[out.length - 1] = out[out.length - 1].trimEnd() + " " + line.trimStart();
      previousWasWrapped = looksWrapped(line);
      continue;
    }

    out.push(line);
    previousWasWrapped = !inFence && looksWrapped(line);
  }

  return out.join("\n");
}
