# Spec — livespec lanes, per-item deep links, full-screen detail

Fork: `thewoolleyman/beads-web` (upstream `weselow/beads-web`, base v0.12.2).
Keywords MUST / SHOULD / MAY are BCP 14. Every MUST has an acceptance
scenario below and a test in `plan.md`.

## Scope

This fork is a **read-only viewer for the maintainer's own use**. Editing,
drag-and-drop, status changes, comments, GitOps and multi-user concerns
are OUT OF SCOPE and MAY be ignored, left broken, or removed. Upstream
behavior does NOT need to be preserved: any existing behavior that
conflicts with the three requirements below MAY be deleted, together with
tests that assert it.

## Why

The family's beads tenants use the livespec lifecycle statuses
`backlog`, `pending-approval`, `ready`, `active`, `acceptance`, `blocked`,
`closed`. Stock beads-web hardcodes bd's four native lanes, forces every
other status into "Open" with a badge, and renders child tasks only inside
their epic's card — so on a real tenant the actionable `ready`/`active`
items never appear as cards and the maintainer cannot see all work items.
Detail opens in a narrow right-hand sheet and there is no per-item URL.

## R1 — Lanes come from the project's actual statuses; every item is a card

1. The kanban MUST render one lane per status in the project's **status
   set**, in a configured order, with a human label per lane.
2. The status set MUST be the ordered union of (a) a configured lane list
   and (b) every distinct raw `status` value present in the project's
   beads. A raw status MUST NOT be remapped or forced into another lane.
3. The configured lane list MUST default to the livespec order
   `backlog, pending-approval, ready, active, acceptance, blocked, closed`.
   It SHOULD be changeable without a code change (an environment variable
   read by the server and exposed to the client) — if that is not easy, a
   hardcoded default is acceptable. Statuses present in the data but
   absent from the list MUST still get a lane, appended after the
   configured ones.
4. **Every bead MUST appear as a card in the lane of its raw status,
   including child tasks of epics.** Nesting under an epic MUST NOT remove
   a bead's own card. The "N beads have unknown statuses" warning MUST be
   removed (every status has a lane).
5. The dashboard's per-project status summary SHOULD count every status
   in the set (optional; stock counts only bd's four native statuses).

## R2 — Per-item deep links; modifier-click opens a new tab

1. Each item MUST have a stable deep link of the form
   `/project?id=<projectId>&bead=<beadId>` (query params — the app is a
   static export, so dynamic routes are not available).
2. Each card MUST be, or contain, a real anchor (`<a href>`) whose `href`
   is that deep link, so that Cmd/Ctrl-click, middle-click and
   "open in new tab" work natively through the browser. A plain click MUST
   open the item's detail in place and MUST NOT navigate away.
3. Loading a URL that carries `bead=<beadId>` MUST open that item's detail
   once the project's beads have loaded; if the id is not in the project
   the board MUST render normally.
4. Opening an item SHOULD put `bead=<beadId>` in the URL (history
   `replace`, not `push`) and closing it SHOULD remove the param, so the
   address bar is always copy-pasteable.
5. The detail view SHOULD expose a one-click "copy link".

## R3 — Item detail is full-screen

1. Opening an item MUST present its detail in a modal that fills the
   viewport (at least 95% of width and height on desktop; edge-to-edge on
   narrow viewports), not a right-hand side sheet.
2. The modal MUST be dismissible by its close control and by Escape and
   MUST return to the board unchanged.
3. Long content MUST scroll inside the modal; the header (id, title,
   close, copy-link) SHOULD stay visible.

## Acceptance scenarios (each maps to a test in `plan.md`)

### Scenario: lanes reflect the real status set
Given a project whose beads carry statuses backlog, ready, active, closed
and one bead with a status not in the configured list, e.g. `triage`
When the board renders
Then it shows lanes in the order backlog, pending-approval, ready, active,
acceptance, blocked, closed, then triage
And every bead sits in the lane of its raw status
And no "unknown statuses" warning is shown.

### Scenario: child tasks are cards
Given an epic with a child task whose status is `ready`
When the board renders
Then the child task appears as its own card in the `ready` lane
And the epic's card still exists in its own lane.

### Scenario: deep link opens the item
Given project P containing bead B
When the browser loads `/project?id=P&bead=B`
Then the board renders and B's detail is open.

### Scenario: modifier-click opens a new tab
Given a rendered card for bead B in project P
Then the card's anchor href equals `/project?id=P&bead=B`
And a plain click opens the detail in place without navigation
And a Ctrl/Cmd-click is left to the browser (no in-place open).

### Scenario: detail is full-screen
Given bead B's detail is open
Then the detail container spans at least 95% of the viewport width and
height
And pressing Escape closes it and the board is unchanged.

## Out of scope

- bd, the Dolt server, and the dolt-server deployment (deployment re-pins
  to a fork build later, in the dolt-server repo).
- Any edit/write path, drag-and-drop, comments, GitOps, auth, read-only
  enforcement, multi-user behavior.
