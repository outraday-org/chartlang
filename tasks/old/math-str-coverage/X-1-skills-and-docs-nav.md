# Task 1 — Skills `math.*` / `str.*` reference + primitives sidebar

> **Status: TODO**

## Goal

Emit `## math.*` and `## str.*` sections into the generated agent
reference `skills/chartlang-coding/references/primitives.md` by
extending `scripts/generate-skills-reference.ts`, update the stale
`SKILL.md` surface description, and add the existing-but-orphaned
`docs/primitives/math.md` / `docs/primitives/str.md` pages to the
VitePress primitives sidebar.

## Prerequisites

None. The core `math` / `str` namespaces and their
`PHASE4_DOC_ENTRIES` registrations already exist.

## Current Behavior

- `scripts/generate-skills-reference.ts` collects only `ta.*`
  (`TA_SRC = packages/runtime/src/ta`), `draw.*`
  (`DRAW_SRC = packages/runtime/src/emit/draw`), and the plot family
  (`PLOT_SRC = packages/core/src/plot/plot.ts`). `renderReference`
  emits exactly three sections: `## ta.*`, `## draw.*`, `## plot
  family`. There is no code path for `math.*` / `str.*`.
- `pnpm skills:gate` passes because the committed `primitives.md`
  byte-matches the (incomplete) generator output — the omission is
  invisible to CI.
- `skills/chartlang-coding/SKILL.md`'s description says it covers the
  "`ta.*`/`draw.*` primitive surface" with no mention of `math.*` /
  `str.*`.
- `docs/.vitepress/config.ts` primitives sidebar (the `items` array
  under the `"/primitives/"` key, ~lines 182–192) lists TA, Draw, Bar
  state, Symbol info, Timeframe, Time, Session — but **not** Math or
  Strings, even though `docs/primitives/math.md` / `str.md` exist and
  generate via `docs:gate`.

## Desired Behavior

- `primitives.md` gains a `## math.*` block and a `## str.*` block,
  each documenting every member with its signature, description,
  `@since`, and stability — produced deterministically by the
  generator and verified by `skills:gate`.
- `SKILL.md`'s description names `math.*` and `str.*`.
- The primitives sidebar links **Math** (`/primitives/math`) and
  **Strings** (`/primitives/str`).

## Requirements

### 1. Extend the skills generator (`scripts/generate-skills-reference.ts`)

Add a namespace collector that reuses the already-exported
`parsePhase4DocEntry` from
`packages/cli/src/commands/genPhase4Docs.ts` (deep-import from source,
the same "source not dist" convention the file uses for
`parsePrimitiveSource` / `parseDrawingSource`). `parsePhase4DocEntry`
returns a `Phase4DocInput` (`{ entry, description, since, stability,
example, signature, sourceUrl }`) for a whole namespace given a
`Phase4DocEntry`.

Reuse the existing math/str entries verbatim from `PHASE4_DOC_ENTRIES`
(also exported from `genPhase4Docs.ts`) — find the entries whose
`title` is `"math"` and `"str"` (their `sourceRelPath` /
`symbolPath` / `outRelPath` are already correct). Do **not** re-declare
the source paths in the skills generator; read them from the shared
registry so they cannot drift.

```ts
import { parsePhase4DocEntry, PHASE4_DOC_ENTRIES } from "../packages/cli/src/commands/genPhase4Docs";

// parsePhase4DocEntry needs the repo root (it resolves sourceRelPath
// against it). REPO_ROOT already exists at the top of the file.
async function collectNamespace(title: "math" | "str"): Promise<Phase4DocInput> {
    const entry = PHASE4_DOC_ENTRIES.find((e) => e.title === title);
    if (entry === undefined) {
        throw new Error(`Missing PHASE4_DOC_ENTRIES entry for "${title}"`);
    }
    return parsePhase4DocEntry(REPO_ROOT, entry);
}
```

Note: `parsePhase4DocEntry` is async and reads `package.json` for a
repo URL via `loadRepoUrl`. That is acceptable here (the skills
generator is tooling, not hermetic-output-sensitive the way the
`PARSE_OPTS` fixed-URL trick implies) — BUT the `sourceUrl` it
produces must NOT be rendered into `primitives.md` (the reference
renders no GitHub links; see `renderTaBlock`/`renderDrawBlock`, which
omit `sourceUrl`). Render only `signature` / `description` / `example`
/ `since` / `stability`. If pulling the repo URL is undesirable, the
fallback is a small TS-AST collector modeled on `collectPlotFamily`
that reads the same members directly — but prefer the
`parsePhase4DocEntry` reuse to avoid duplicating the namespace walk.

### 2. Render the new sections

Add a `renderNamespaceBlock(title: string, doc: Phase4DocInput):
string` that emits a `## <title>.*` section. The `Phase4DocInput`
`signature` already contains the full namespace member list (it is the
consolidated namespace signature). Render:

```
## math.*

<description>

```ts
<signature>
```

**Example:** `<example>`
**Since:** <since> · <stability>
```

Wire both blocks into `renderReference` after `## plot family` (append;
do not reorder the existing sections — `skills:gate` byte-diffs). Update
`renderReference`'s signature to accept the two `Phase4DocInput`s, and
`generateSkillsReference` to `await collectNamespace("math")` /
`collectNamespace("str")` alongside the existing
`Promise.all([collectTa(), collectDraw(), collectPlotFamily()])`.

Update the header preamble line in `renderReference` (currently "Run
`pnpm skills:generate` after changing a `ta.*` / `draw.*` /
plot-family primitive") to also mention `math.*` / `str.*`.

### 3. Regenerate and commit `primitives.md`

Run `pnpm skills:generate` to write the new sections, then verify
`pnpm skills:gate` is green (it byte-diffs the committed file against a
fresh render). Never hand-edit `primitives.md`.

### 4. Update `SKILL.md` description

In `skills/chartlang-coding/SKILL.md`, edit the `description:`
frontmatter / surface summary so it names the `math.*` and `str.*`
namespaces alongside `ta.*` / `draw.*` (e.g. "…the full
`ta.*`/`draw.*`/`math.*`/`str.*` primitive surface"). Keep the change
minimal and consistent with the existing wording.

### 5. Add Math + Strings to the primitives sidebar

In `docs/.vitepress/config.ts`, inside the primitives sidebar `items`
array (the one currently containing `{ text: "TA", … }` …
`{ text: "Session", … }`), add:

```ts
{ text: "Math", link: "/primitives/math" },
{ text: "Strings", link: "/primitives/str" },
```

Place them in a sensible position (e.g. after "Draw", before "Bar
state", or grouped with the value namespaces) — match the surrounding
ordering style. Confirm the links resolve to the existing
`docs/primitives/math.md` / `str.md` pages (the `.md` is implicit in
VitePress links).

Note: the primitives sidebar `items` array spans roughly lines 184–256
(the value-namespace rows TA…Session sit ~184–190). `docs/language/math.md`
/ `strings.md` are ALREADY linked from the separate **Language** sidebar
(~lines 158–159) — that is correct and unchanged; this task adds the
distinct **primitives** pages to the **primitives** sidebar.

### 6. Fix the now-stale `packages/core/CLAUDE.md` invariant

`packages/core/CLAUDE.md` (in the `request.security` invariant) currently
asserts the skills reference "covers only `ta.*` / `draw.*` / plot-family":

> (`pnpm skills:generate` does NOT emit `request.*` — the skills
> `primitives.md` covers only `ta.*` / `draw.*` / plot-family;
> `request.security` is taught in the hand-authored `SKILL.md`.)

This task makes that statement false — `primitives.md` will also cover
`math.*` / `str.*`. Per root `CLAUDE.md` ("a behavior change that
invalidates a documented invariant must update the `CLAUDE.md` in the same
PR"), update that parenthetical to read "…covers `ta.*` / `draw.*` /
plot-family / `math.*` / `str.*` (still NOT `request.*`)". Do **not** touch
any other part of `core/CLAUDE.md`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `scripts/generate-skills-reference.ts` | Modify | Add `collectNamespace` + `renderNamespaceBlock`; wire into `renderReference` / `generateSkillsReference`; update header preamble |
| `skills/chartlang-coding/references/primitives.md` | Modify (regenerated) | Gains `## math.*` / `## str.*` sections via `pnpm skills:generate` |
| `skills/chartlang-coding/SKILL.md` | Modify | Description names `math.*` / `str.*` |
| `docs/.vitepress/config.ts` | Modify | Primitives sidebar links Math + Strings |
| `scripts/generate-skills-reference.test.ts` | Modify | Add a case asserting the math/str sections render (the file exists; see Gates) |
| `packages/core/CLAUDE.md` | Modify | Fix the stale "primitives.md covers only ta/draw/plot-family" parenthetical (§6) |
| `scripts/CLAUDE.md` | Modify | Note `generate-skills-reference.ts` now also walks `math.*` / `str.*` |

## Gates

- `pnpm skills:generate` then `pnpm skills:gate` — green (committed
  `primitives.md` matches fresh render with the new sections).
- `pnpm test:scripts` — if `generate-skills-reference` has a test,
  extend it to assert `renderReference` output contains `## math.*` and
  `## str.*`; keep it green. (Scripts have coverage off — no 100% gate
  — but do not regress existing assertions.)
- `pnpm docs:dev` / `docs:build` (or a manual nav check) — Math /
  Strings appear in the primitives sidebar and the pages load.
- `pnpm typecheck` — the deep-import of `parsePhase4DocEntry` /
  `PHASE4_DOC_ENTRIES` type-checks.

## Changeset

**None.** This task touches only tooling (`scripts/`), the skill
content (`skills/`), docs config (`docs/`), and two agent-facing
`CLAUDE.md` files (`scripts/`, `packages/core/`) — no published
`@invinite-org/chartlang-*` package **source** (`src/`) changes (a
`CLAUDE.md` edit is documentation, not shipped code). Add a changeset
only if you end up modifying a published package's `src/`.

## Acceptance Criteria

- `primitives.md` contains `## math.*` (all 9 members) and `## str.*`
  (all 14 members), generated — not hand-edited.
- `pnpm skills:gate` passes and now genuinely guards the math/str
  sections (re-running `skills:generate` after a member change would
  fail the gate until regenerated).
- `SKILL.md` description names both namespaces.
- The primitives sidebar links Math + Strings; both pages are
  reachable.
- The generator reuses `parsePhase4DocEntry` / `PHASE4_DOC_ENTRIES`
  rather than re-declaring the math/str source paths.
- `pnpm typecheck`, `pnpm test:scripts` green.
- The per-folder `scripts/CLAUDE.md` map entry for
  `generate-skills-reference.ts` is updated to note it now also walks
  the `math.*` / `str.*` namespaces (the documented invariant changed).
- The stale `packages/core/CLAUDE.md` parenthetical ("primitives.md
  covers only `ta.*` / `draw.*` / plot-family") is corrected to include
  `math.*` / `str.*` (still excluding `request.*`).
