# Plan — Task 1: Core `bgcolor` / `barcolor` holes + opts + registry + shim

## Context

Deliverable 1 (ergonomics tier) of `bgcolor-barcolor-ergonomics`. Add two
top-level Pine-ergonomic sentinel holes on `@invinite-org/chartlang-core` —
`bgcolor(color, opts?)` / `barcolor(color, opts?)` — that are pure sugar for
the already-landed `plot(NaN, { style: { kind: "bg-color"|"bar-color", color,
transp? } })` pipeline. Plus two opts types, two `STATEFUL_PRIMITIVES` entries
(slot-injected), the compiler ambient-shim mirror in lockstep, type-level +
compile tests, regen of the hover registry, and the Deliverable-1 changeset.

ZERO runtime / wire / validator / renderer change in this task (Task 2 wires
the runtime impl; Task 3 the docs/skill surface).

## Pre-existing work (verified, do NOT touch)

- Working tree carries uncommitted state-array + multi-symbol-security
  features. Changesets `.changeset/state-array.md` and
  `.changeset/multi-symbol-security.md` already exist. Core is at 1.2.0; those
  pending minors land the next release at 1.4.0 → `@since 1.4` is correct
  (the `z` field at `plot.ts:248` already uses `@since 1.4`).
- `bg-color` / `bar-color` `PlotOptsStyle` arms already exist
  (`plot.ts:192` / `:201`); `Color = string` (`types.ts:240`).
- `plot` (`plot.ts:306`) / `hline` (`plot.ts:322`) sentinel holes throw
  `"<name> called outside compiled runtime"`.
- `STATEFUL_PRIMITIVES_BY_NAME` derives from the same canonical array — no
  extra edit; the two new entries appear in both automatically.
- No naming conflict: grep found no existing `bgcolor` / `barcolor` /
  `BgColorOpts` / `BarColorOpts` symbol in core or compiler `src/`.

## Issues found / decisions

1. **Task hole JSDoc omits the stability marker.** The provided snippet for
   the holes has `@since` + `@example` but no `@stable`. The siblings
   (`plot` / `hline`) carry `@stable`, and the project standard requires a
   stability marker on every export. → Add `@stable` to all four symbols.

2. **Hover registry regen (not in the task's gate list, but a real CI gate).**
   `gen-hover-registry` walks every core export; `plot` / `hline` already
   appear (`hoverRegistry.generated.ts:3098/4235`). Adding the four exports
   drifts `hover:check`. → Re-run `pnpm gen-hover-registry` and commit the
   regenerated file (per `scripts/CLAUDE.md`).

3. **`skills:gate` is NOT affected** — the generator only emits `ta.*` /
   `draw.*` today; plot-family holes are surfaced in Task 3. No regen here.

4. **`ComputeContext` is deliberately NOT touched.** The task's files table
   lists only `plot.ts` / `index.ts` / `statefulPrimitives.ts` / `program.ts`
   / tests / changeset, and names "the four symbols". The compile-test
   fixture calls `bgcolor` / `barcolor` via the **top-level import** (in scope
   inside `compute`), which type-checks against the shim's `export function
   bgcolor` — so no `ComputeContext.bgcolor` field is needed. Mirrors how the
   `plot` top-level import is in scope in every fixture. Keeps the diff
   minimal and matches the task boundary. (`ctx.bgcolor` is a possible Task-2
   ergonomic but is out of scope here.)

5. **Registry count comments.** Two doc comments in `statefulPrimitives.ts`
   say "currently 177 entries"; after appending two it is 179. → Bump both.

6. **Compiler `STATEFUL_PRIMITIVES` shim** is a bare `ReadonlySet`
   declaration (`program.ts:1441`) — no shape change, the runtime/core array
   is the SSOT. Confirmed; no edit needed there.

7. **Test layering.** Core plot tests live in a SINGLE `plot.test.ts` that
   already mixes sentinel-throw + type-level (`@ts-expect-error`) assertions
   (no separate `*.types.test.ts` for plot). → Extend `plot.test.ts` in place
   (sentinel throws + expect-type-style assertions), matching the file's
   existing convention rather than creating a new `.types.test.ts`. (Note:
   `plot.test.ts` uses inline `as ...`-free type assertions / `@ts-expect-error`
   today, not `expect-type`; I follow that local convention. The task's
   "expect-type" mention is satisfied by equivalent type-level assertions in
   the same file — `transp` present on `BgColorOpts`, absent on `BarColorOpts`,
   call-shape checks.)

## Steps (verified paths)

1. `packages/core/src/plot/plot.ts` — after `HLineOpts` (`:288`) / before the
   `plot` hole, add `BgColorOpts` + `BarColorOpts` types; after `hline`
   (`:324`) add `bgcolor` + `barcolor` holes. JSDoc: `@since 1.4`, `@stable`,
   `@example` (chartlang import + `try { … } catch {}`, no `defineIndicator`
   so docs-check does not execute it — mirrors `plot`/`hline`). Throw
   `"bgcolor called outside compiled runtime"` /
   `"barcolor called outside compiled runtime"`. `Color` already imported.

2. `packages/core/src/index.ts` — extend the plot re-export lines (`:233-234`):
   add `bgcolor, barcolor` to the value export and `BgColorOpts, BarColorOpts`
   to the type export. (Plot barrel `plot/index.ts` is `export * from
   "./plot.js"` — picks them up automatically; no edit.)

3. `packages/core/src/statefulPrimitives.ts` — append
   `{ name: "bgcolor", slot: true }`, `{ name: "barcolor", slot: true }` after
   the `{ name: "hline", slot: true }` / `{ name: "alert", slot: true }` plot
   region (`:115-117`). Bump the two "currently 177 entries" comments to 179.

4. `packages/core/src/plot/plot.test.ts` — add sentinel-throw tests for
   `bgcolor("#000")` / `barcolor("#000")`; add type-level assertions
   (call shapes + `transp` only on `BgColorOpts`).

5. `packages/compiler/src/program.ts` — in the `declare module
   "@invinite-org/chartlang-core"` block: add `BgColorOpts` / `BarColorOpts`
   type decls next to `HLineOpts` (`:830`), and `bgcolor` / `barcolor`
   function decls next to `plot` / `hline` (`:837-838`).

6. `packages/compiler/src/compile.test.ts` — add a positive `compile()` test
   importing `bgcolor` / `barcolor`, with the fixture body:
   `bgcolor(bar.close > bar.open ? "#16a34a" : "#dc2626", { transp: 80 });`
   `barcolor(bar.close > bar.open ? "#16a34a" : "#dc2626");` — asserts compile
   succeeds (no type diagnostics → shim mirrors core).

7. `pnpm gen-hover-registry` — regenerate
   `packages/language-service/src/hoverRegistry.generated.ts` (picks up the
   four new exports). Commit the regenerated file.

8. `.changeset/bgcolor-barcolor.md` — the Deliverable-1 feature changeset
   (core minor, compiler minor, runtime minor, pine-converter patch — exactly
   as the task specifies; covers Tasks 1–3).

## Files table

| File | Action |
|------|--------|
| `packages/core/src/plot/plot.ts` | Modify — 2 opts types + 2 holes |
| `packages/core/src/index.ts` | Modify — root re-export of 4 symbols |
| `packages/core/src/statefulPrimitives.ts` | Modify — 2 registry entries + count comments |
| `packages/core/src/plot/plot.test.ts` | Modify — sentinel + type tests |
| `packages/compiler/src/program.ts` | Modify — shim mirror (2 types + 2 fns) |
| `packages/compiler/src/compile.test.ts` | Modify — positive compile test |
| `packages/language-service/src/hoverRegistry.generated.ts` | Regenerate |
| `.changeset/bgcolor-barcolor.md` | Create |

## Gates to keep green

- `pnpm -F @invinite-org/chartlang-core typecheck` / `... test` (100% cov —
  the two new sentinel throws are asserted)
- `pnpm -F @invinite-org/chartlang-compiler test`
- `pnpm lint` (4-space, double-quote, trailing comma, `import type`)
- `pnpm docs:check` (JSDoc `@since`/`@example`/`@stable`)
- `pnpm hover:check` (regenerated)

## Changeset

`.changeset/bgcolor-barcolor.md` — core minor, compiler minor, runtime minor,
pine-converter patch (shared across Deliverable-1 Tasks 1–3).

## Acceptance criteria

- `bgcolor` / `barcolor` holes + `BgColorOpts` / `BarColorOpts` defined,
  exported (barrel + root), fully JSDoc'd, throwing the documented sentinel.
- Two `STATEFUL_PRIMITIVES` entries appended; `BY_NAME` picks them up.
- `program.ts` shim mirrors core; positive `compile()` test type-checks usage.
- Type test proves `transp` only on `BgColorOpts`.
- No wire / validator / renderer change.
- Hover registry regenerated; changeset committed.
