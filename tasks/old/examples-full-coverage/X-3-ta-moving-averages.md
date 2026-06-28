# TA — Moving Averages & Overlays

> **Status: TODO**

## Goal

Ship one runnable example per moving-average / overlay `ta.*` primitive,
category `ta-moving-averages`, wired into `examples/scripts/`, the
catalogue, the demo, and docs — shrinking the coverage allowlist by this
family.

## Prerequisites

Tasks 1 (catalogue + generators + gate) and 2 (demo dialog). All later
population tasks share these two prereqs and the same playbook.

## Authoring playbook (applies to every example in this task)

Each example is `examples/scripts/<id>.chart.ts`:

- MIT header (2 lines), then **top-level imports AND destructured
  `compute({ bar, … })` params together** — both are required (per
  `examples/CLAUDE.md`: the compiler's `extractCapabilities` needs the
  named imports, the runtime needs the destructured impls).
- `export default defineIndicator({ name, apiVersion: 1,
  overlay: <bool>, compute(ctx) { … } })`. `overlay: true` for
  price-scale series (MAs draw on the candles); `overlay: false` for
  oscillators (separate pane).
- Must **compile clean** (the script is added to e2e via the catalogue
  derivation from Task 1) and **run without throwing** on the demo's
  daily candles. If a primitive needs data the demo lacks (volume,
  secondary timeframe), a NaN render is acceptable — but it must not
  throw.
- One short comment in `compute` explaining what the primitive shows.

Per id: add an `ExampleMeta` entry `{ id, label, description,
category: "ta-moving-averages", primitives: ["<id>"] }` to this task's
own fragment file `examples/catalogue/ta-moving-averages.ts`. `id` is
kebab-case and unique (suffix `-demo` unless a clearer slug fits).

**Sequential mode:** also remove the id from
`examples/coverage-allowlist.json` and run `pnpm examples:generate` +
`pnpm examples:coverage` to keep the gate green.
**Parallel (worktree) mode:** skip the allowlist edit and the two
generator commands — they run once at the wave-boundary integration
step (see README "Execution Plan & Parallelization"). Either way, this
task owns only its `.chart.ts` files + its catalogue fragment, so it
never collides with sibling W1 tasks. This sequential-vs-parallel
guidance applies to every population task (3–21).

> Some ids in the table are **already covered** by the Task-1 migrated
> examples (and so are not in the allowlist). Create examples only for
> ids still in `coverage-allowlist.json`. The "Status" column flags
> the pre-covered ones.

## Primitives

| Primitive id | Status | Example concept |
|--------------|--------|-----------------|
| `ta.sma` | covered (`sma-offset`) | — |
| `ta.ema` | covered (`ema-cross`) | — |
| `ta.wma` | new | WMA(20) overlay vs SMA(20) to show weighting. |
| `ta.hma` | new | Hull MA(16) overlay, faster turn vs EMA. |
| `ta.dema` | new | DEMA(20) overlay, reduced lag. |
| `ta.tema` | new | TEMA(20) overlay. |
| `ta.smma` | new | Smoothed MA(14) (RMA) overlay. |
| `ta.vwma` | new | Volume-weighted MA(20) overlay (note: needs volume). |
| `ta.alma` | new | Arnaud Legoux MA(20) overlay; show `offset`/`sigma` opts. |
| `ta.kama` | new | Kaufman adaptive MA overlay. |
| `ta.lsma` | new | Least-squares MA(25) overlay. |
| `ta.mcginley` | new | McGinley Dynamic(14) overlay. |
| `ta.maRibbon` | new | Multi-length MA ribbon (several `plot`s from one helper). |

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/scripts/<id>.chart.ts` (×11 new) | Create | One example per uncovered id. |
| `examples/catalogue/ta-moving-averages.ts` | Create (own) | Add the family's entries. |
| `examples/coverage-allowlist.json` | Modify | Remove this family's ids. |
| `apps/site/src/components/demo/scripts.ts` | Regenerate | Via `examples:generate`. |
| `docs/examples/<id>.md` (×11) | Regenerate | Via `examples:generate`. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm test` (e2e compiles every new script)
- `pnpm examples:gate` (scripts.ts + docs/examples byte-clean)
- `pnpm examples:coverage` (still green; family ids removed)

## Changeset

`.changeset/examples-ta-moving-averages.md` — **patch** (examples +
docs only; no published-package surface change).

## Acceptance Criteria

- One compiling, runtime-clean example per uncovered id above.
- Catalogue entries added; family ids removed from the allowlist.
- `examples:generate` regenerated `scripts.ts` + `docs/examples`;
  `examples:gate` + `examples:coverage` green; e2e green.
