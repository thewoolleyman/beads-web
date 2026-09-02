# Plan — livespec lanes, deep links, full-screen detail (read-only fork)

Spec: [`spec.md`](spec.md). Repo: `/data/projects/beads-web` (fork
`thewoolleyman/beads-web`; `origin` = fork, `upstream` = weselow; base
v0.12.2 `c459cf3`). Every file:line below was verified against that
checkout on 2026-09-02.

## Scope and rules of engagement

- Read-only viewer for the maintainer only. Editing, DnD, status changes,
  comments, GitOps: out of scope; upstream behavior need not be preserved
  and MAY be deleted where it conflicts.
- Tests exist (Vitest + Testing Library, jsdom), so **TDD**: for each task
  write the failing test, make it pass, keep `npm test`, `npm run
  typecheck`, `npm run lint`, `npm run build` green. Delete or rewrite an
  existing test only when it asserts behavior we intentionally removed.
- Do the mechanical work (file edits, running suites, screenshots) with
  cheaper subagents; keep design decisions at the top.
- Branch `feat/livespec-lanes-deeplinks-fullscreen` off `main`; conventional
  commit subjects (`feat(kanban): …`, `test(…): …`); trailers
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and
  `Claude-Session: <url>`; PR against **the fork's** `main`, never
  upstream.
- Never run `bd init` here, and never create a `.beads/` directory in this
  checkout. **State as of 2026-09-02:** `npm ci` already ran upstream's
  `prepare` → `scripts/install-hooks.sh`, so `.git/hooks/pre-commit` IS
  installed. Its first step ("beads sync flush") only runs when
  `$MAIN_REPO_ROOT/.beads` exists — it does not here (no `.beads/` is
  tracked or present), so it is a no-op; keep it that way. Its later
  steps run ESLint + `tsc --noEmit` on staged TS and `cargo clippy` on
  staged Rust; clippy cannot compile until `out/` exists, so run
  `npm run build` before committing any `server/**` change. `--no-verify`
  is not the answer; the checks are the ones we want.

## Constraints discovered (why the design is shaped this way)

- `next.config.js` is `output: 'export'` (static export embedded in the
  Rust binary via rust-embed) → deep links MUST be query params; the app
  already reads `?id=` via `useSearchParams` (`src/app/project/kanban-board.tsx:59-61`).
- No source of a project's status set exists anywhere: `bead.status` is a
  raw `String` from `bd list --json --all` (`server/src/routes/beads.rs:134,
  360-370`); `.beads/config.yaml` is only parsed for `sync-branch`
  (`beads.rs:56-99`). Lanes must therefore be derived from data plus a
  configured default order.
- The live board has **no drag-and-drop** (dnd-kit primitive at
  `src/components/ui/kanban.tsx` is orphaned). Nothing to protect.
- Status remapping lives in `STATUS_MAP` (`src/types/index.ts:97-113`) and
  `mapBeadStatus` (`src/lib/beads-parser.ts:28-59`, unknown → `open` +
  badge). Column set is `COLUMNS` (`kanban-board.tsx:48-53`), grid is a
  literal `grid-cols-4` (`kanban-board.tsx:360`), children are dropped by
  `!b.parent_id` (`kanban-board.tsx:163-169`). Column colors are 4-way
  `switch(status)` blocks in `src/components/kanban-column.tsx:14-93`.
- The detail is a hand-rolled fixed slide-over, not a Radix Sheet:
  `src/components/bead-detail.tsx:216-227`, width capped by
  `w-full sm:max-w-lg md:max-w-xl` (the "sliver"). Mounted from
  `kanban-board.tsx:382-410`. Open/close state is local `useState` in
  `src/hooks/use-bead-detail.ts:26-44`, never synced to the URL.
- Cards are `<div role="button">` with a synthetic `onClick`
  (`src/components/bead-card.tsx:167-180` `interactionProps`, roots at
  224/284/347 for the three layouts) — no `href`, so no native new-tab.
- Package manager is **npm** (`package-lock.json`; CI uses `npm ci`;
  `pnpm-lock.yaml` is vestigial). Vitest config: jsdom, `globals: true`,
  setup `src/test-setup.ts`, alias `@ → ./src`, excludes `tests/**`
  (Playwright). Playwright e2e (`tests/themes.spec.ts`) needs the Rust
  server running on :3008 with seeded projects — optional/manual here.

## Design

### F1 — lanes from the real status set; every bead is a card

- **New `src/lib/lanes.ts`**:
  `DEFAULT_LANES = ['backlog','pending-approval','ready','active','acceptance','blocked','closed']`;
  `deriveLanes(beads, configured = DEFAULT_LANES): Lane[]` → configured
  order first, then every other distinct raw status in first-seen order;
  drop `tombstone`; `Lane = { status: string; title: string }` with
  `title` = humanized status (`pending-approval` → "Pending Approval");
  `laneAccent(status)` → palette entry with a neutral fallback.
- **`src/types/index.ts`**: `BeadStatus` becomes `string`; delete
  `KnownRawStatus`/`STATUS_MAP` (or leave unreferenced); `KanbanColumn.id:
  string`.
- **`src/lib/beads-parser.ts`**: `mapBeadStatus` keeps the raw status
  verbatim (only `tombstone` → dropped); no forcing to `open`, no
  warning badge; remove `getUnknownStatusBeads/Names` and the
  `unknownStatusCount/Names` props on `QuickFilterBar`
  (`kanban-board.tsx:192-193, 343-344`; banner in
  `src/components/quick-filter-bar.tsx:289-317`).
- **`kanban-board.tsx`**: replace `COLUMNS` with
  `useMemo(() => deriveLanes(filteredBeads, lanes), …)`; **delete the
  `!b.parent_id` filter** (children become cards; keep the issue-type
  filter); group by raw status; replace `grid-cols-4` with an inline
  `gridTemplateColumns: repeat(${n}, minmax(280px, 1fr))` inside an
  `overflow-x-auto` wrapper.
- **`kanban-column.tsx`**: `status: string`; replace the four `switch`
  blocks with `laneAccent(status)`.
- **`src/hooks/use-epics.ts:42-50`** (cosmetic): `completed` =
  `closed`; `inProgress` = `active` or `in_progress`.
- **Optional (only if < 30 min): queryable config.** Rust: read env
  `BEADS_WEB_LANES` (comma-separated) in `server/src/main.rs`, serve
  `GET /api/lanes` → `{ "lanes": [...] }` (default = the livespec list);
  frontend `useLanes()` fetches it with `DEFAULT_LANES` as the fallback.
  If skipped, `DEFAULT_LANES` is the configured list. Dashboard donut
  (`upsert_counts_cache`, `beads.rs:296-354`; `CachedCounts`,
  `db.rs:80-89`) stays as-is unless trivially made a `HashMap<String,i64>`.

### F2 — deep links + native modifier-click

- **New `src/lib/bead-link.ts`**: `beadHref(projectId, beadId)` →
  `/project?id=${enc(projectId)}&bead=${enc(beadId)}`;
  `isModifiedClick(e)` → `metaKey || ctrlKey || shiftKey || button === 1`.
- **`bead-card.tsx`**: make the card root an `<a href={beadHref(...)}>`
  for all three layouts (one change in `interactionProps` + the three
  roots); `onClick`: if `isModifiedClick(e)` return (browser opens the
  tab), else `e.preventDefault(); onSelect(bead)`; `onKeyDown` Enter →
  `preventDefault(); onSelect`. Thread `projectId` down from
  `kanban-board` → `KanbanColumn` → `BeadCard`/`EpicCard` (prop or a small
  React context). Apply the same anchor treatment to `EpicCard`'s root and
  to child rows in the epic's subtask list.
- **`src/hooks/use-bead-detail.ts`**: take `projectId`, `beads`,
  `router`, `searchParams`. On beads loaded: if `searchParams.get('bead')`
  matches a bead → open it. `openBead` → `router.replace(beadHref)`;
  close → `router.replace('/project?id=' + enc(projectId))`.
- **`bead-detail.tsx` header**: "Copy link" button →
  `navigator.clipboard.writeText(location.origin + beadHref(...))`.

### F3 — full-screen detail

- **`bead-detail.tsx:216-227`**: keep the overlay; change the panel to
  `fixed inset-0 md:inset-[2.5vh_2.5vw] z-50 w-auto max-w-none
  md:rounded-xl overflow-y-auto` (drop `right-0`, `sm:max-w-lg`,
  `md:max-w-xl`, and the translate-x slide — fade is fine); wrap id /
  title / close / copy-link in a `sticky top-0` header; add a `keydown`
  Escape listener that calls `onOpenChange(false)` if none exists.
  Edit controls MAY be hidden (read-only) but need not be.

## Tests (write first; jsdom + Testing Library; `next/navigation` mocked)

- `src/lib/__tests__/lanes.test.ts` — order = configured then extras in
  first-seen order; `tombstone` excluded; label humanization; accent
  fallback.
- `src/lib/__tests__/beads-parser.test.ts` — raw status preserved (no
  remap to `open`); child beads (with `parent_id`) retained.
- `src/lib/__tests__/bead-link.test.ts` — href shape + encoding;
  `isModifiedClick` for meta/ctrl/shift/middle.
- `src/components/__tests__/bead-card.test.tsx` — anchor `href`; plain
  click → `onSelect` called and `preventDefault`; ctrl-click → neither.
- `src/hooks/__tests__/use-bead-detail.test.tsx` — opens from `?bead=`
  once beads load; `router.replace` called with the deep link on open and
  with the bare project URL on close.
- `src/components/__tests__/bead-detail.test.tsx` — panel has the
  full-screen classes (no `max-w-lg`/`max-w-xl`); Escape →
  `onOpenChange(false)`; copy-link writes the deep link.
- `src/app/project/__tests__/kanban-board.test.tsx` (if the component can
  be rendered with mocked hooks in < 30 min) — lanes rendered = derived
  set; a child task renders as its own card; no unknown-status banner.
- Existing suites (`api`, `bead-utils`, `issue-types`, `utils`,
  `create-bead-dialog`, `update-banner`, `use-projects`) stay green; none
  assert the remapping we remove.

## Implementation tasks (in order; each = red → green → commit)

1. `lanes.ts` + tests.
2. Parser: raw status, keep children, remove unknown-status plumbing +
   tests (update `QuickFilterBar` props).
3. Board: derived lanes, no parent filter, dynamic grid; column palette.
4. `bead-link.ts` + tests.
5. Card/epic/subtask anchors + `projectId` threading + tests.
6. `use-bead-detail` URL sync + tests.
7. Copy-link button.
8. Full-screen detail + Escape + tests.
9. Optional: `GET /api/lanes` from `BEADS_WEB_LANES`; optional donut counts.
10. `npm test && npm run typecheck && npm run lint && npm run build`;
    `cd server && cargo build --release` if the server was touched.

## Verification

- Automated: the four npm checks above. **Green baseline recorded
  2026-09-02 on a clean checkout** (Node v26.3.0, `npm ci`, 835 packages):
  `npm test` **60/60 pass** (8 files, ~5.5s); `npm run typecheck` clean;
  `npm run lint` clean. 21 pre-existing npm audit findings — ignore.
  `esbuild` and `unrs-resolver` install scripts are gated by
  allow-scripts and were not approved; tests still pass without them.
- Rust: `cargo` 1.100.0-nightly is available, but `cargo test`/`cargo
  build` on a fresh checkout **fails to compile until `npm run build`
  has produced `out/`** (`server/src/main.rs:25` embeds `../out/` via
  rust-embed). Always run `npm run build` before any cargo step.
- Playwright 1.57.0 with cached Chromium is available; its
  `baseURL` is `:3008` (the Rust server), while `npm run dev` binds
  `:3007` — the e2e assumes the built server, so treat it as manual.
- Manual (recommended once, against real data): build the binary
  (`npm run build && cd server && cargo build --release`), run it under the
  dolt-server credential wrapper with `HOME=/data/projects` and a
  registered tenant, open `/project?id=<id>&bead=<beadId>`, Ctrl-click a
  card, confirm the seven lanes and that a `ready` child task is a card.

## Risks

- `useSearchParams` under static export needs a Suspense boundary — the
  existing `kanban-board.tsx` already does this; keep the pattern.
- Seven-plus lanes need horizontal scroll at common widths — the
  `overflow-x-auto` wrapper handles it.
- A child now appears both as its own card and inside its epic's card
  (progress bar) — acceptable for a read-only viewer.
- The tracked `.beads/` in this repo is upstream's; never write to it.

## After this lands (out of scope here)

Tag a fork release; in the dolt-server repo re-pin `BEADS_WEB_VERSION` /
`BEADS_WEB_SHA256` to the fork asset, re-land SPECIFICATION v013 to
specify the fork and lifecycle lanes, and redeploy with
`scripts/install-beads-web.sh`.
