# `bgcolor` / `barcolor` ergonomics — Pine aliases + dynamic per-bar color

## Overview

chartlang **already ships** pane-background and bar-tint styling: a script
writes them today as `plot()` styles —

```ts
plot(NaN, { style: { kind: "bg-color", color: "#1d4ed8", transp: 80 } });
plot(NaN, { style: { kind: "bar-color", color: "#a855f7" } });
```

These styles are landed end-to-end: the author style `PlotOptsStyle`
(`packages/core/src/plot/plot.ts:192` `bg-color`, `:201` `bar-color`), the
wire `PlotStyle` (`packages/adapter-kit/src/types.ts:451` / `:457`), the
runtime `buildStyle` (`packages/runtime/src/emit/plot.ts:67-74`), the
validator (`validateBgColorStyle` `…/validateEmission.ts:371`; `bar-color`
via `validateSingleColorStyle` `:435`), the reference renderer
(`renderBackgroundOverlays` `…/createCanvas2dAdapter.ts:369` →
`drawBgColor` `src/render/bgColor.ts:33`; `renderBarOverlays` `:385`),
the capability bag (`src/capabilities.ts:38-39`), four conformance
scenarios (`packages/conformance/src/scenarios/plotKind{BgColor,BarColor}
{,Gated}.scenario.ts`), and the Pine converter (`bgcolor`→`bg-color`,
`barcolor`→`bar-color` at `packages/pine-converter/src/transform/
plotFamily.ts:177-180`, emitting `plot(Number.NaN, { style })` via
`emitBackground` `:349-359`).

So this is **not** a "missing feature" task. It closes three real
**ergonomics + expressiveness** gaps, split into two clearly-separated
deliverables:

- **DELIVERABLE 1 — the ergonomics tier (small, additive, ship now).**
  - **(A)** No top-level `bgcolor(color, opts?)` / `barcolor(color, opts?)`
    Pine-ergonomic aliases. An author who knows Pine reaches for
    `bgcolor(close > open ? green : red)` and instead has to write the
    verbose `plot(NaN, { style: { kind: "bg-color", color: … } })`. Add the
    two sugar holes that lower to the **existing** landed pipeline (no new
    emission kind, no new style arm).
  - **(B)** The `bg-color` / `bar-color` styles — and the new aliases — are
    **invisible in the generated author reference**
    (`skills/chartlang-coding/references/primitives.md`). The generator only
    emits `ta.*` and `draw.*` blocks today (see *Current State*), so plot
    styling is taught in `SKILL.md` prose only. Surface the aliases there.

- **DELIVERABLE 2 — the `Series<Color>` tier (large, product-gated).**
  - **(C, the big one)** Color is a **static string baked at emit time**.
    `PlotEmission.color` is one `string | null` for the whole slot per bar,
    and the alias/style `color` field is a single `Color` value — there is
    **no per-bar `Series<Color>` value channel**. So
    `bgcolor(close > open ? color.green : color.red)` *as a single call that
    recolors every bar by that bar's condition* is **not expressible** today:
    the converter even emits `plot(Number.NaN, …)` precisely because there is
    no dynamic-color value to carry. Closing this needs a first-class
    per-bar dynamic-color value channel through the wire, validation,
    dedup, and **every** adapter — a substantial cross-layer change.

**Deliverable 1 can ship immediately.** Deliverable 2 is **gated on a
product decision** (the cross-layer cost + the wire-shape choice in
*Architecture Decisions*); it is documented here in full so the decision
can be made against a concrete design. Both `bgcolor`/`barcolor` AND
ordinary value-driven plot colors (`plot(x, { color: up ? green : red })`,
also static today) would benefit from the Deliverable-2 channel — it is not
a `bgcolor`-only feature.

Relevant repo contracts: root `CLAUDE.md` (skill + per-folder `CLAUDE.md`
update rules, `skills:generate`/`skills:gate`), `packages/core/CLAUDE.md`
(sentinel holes, `STATEFUL_PRIMITIVES` additive-within-`apiVersion:1` rule),
`packages/compiler/CLAUDE.md` (callsite-id format, `manifest.plots[*].slotId`
must equal the injected literal, `plotKindFromCallsite`), `packages/runtime/
CLAUDE.md` (`emit/*` overload seam, `pushPlot` validate + dedup last-write-
wins per `(slotId, bar)`), `packages/conformance/CLAUDE.md` (`plot-hash`
covers `{ bar, value }` in emission order — **changing wire order re-breaks
every pinned hash**), `packages/pine-converter/CLAUDE.md` (`plotFamily.ts`
`emitBackground`).

## Current State

- **Styles exist, top-level aliases do not.** `plot` / `hline` are the only
  plotting holes on core (`packages/core/src/plot/plot.ts:291` / `:307`).
  There is no `bgcolor` / `barcolor` export. `STATEFUL_PRIMITIVES`
  (`packages/core/src/statefulPrimitives.ts`) lists `plot` / `hline` /
  `alert` as `{ slot: true }`; there is no `bgcolor` / `barcolor` entry.
- **`PlotOptsStyle` already carries both arms.** `bg-color`
  (`packages/core/src/plot/plot.ts:192`, `{ color: Color; transp?: number }`)
  and `bar-color` (`:201`, `{ color: Color }`); `Color = string`
  (`packages/core/src/types.ts:240`).
- **The wire is numeric-value-only.** `PlotEmission`
  (`packages/adapter-kit/src/types.ts:491`) has `value: number | null`
  (`:498`, NaN/Infinity forbidden — `value: null` is the wire "skip this
  bar") and a single static `color: string | null` (`:499`). `PlotStyle`
  (`:360-467`) is a 17-arm union; `bg-color` (`:451`) carries
  `color: Color; transp?: number`, `bar-color` (`:457`) carries
  `color: Color`. There is **no `Series<Color>` / per-bar color channel** on
  either the emission or the style.
- **Runtime maps style → wire and validates.** `buildStyle`
  (`packages/runtime/src/emit/plot.ts:28-86`) copies `bg-color`/`bar-color`
  through (`:67-74`); `plotImpl` (`:88-131`) capability-gates
  `ctx.capabilities.plots.has(style.kind)` (`:96`) → `unsupported-plot-kind`
  diagnostic otherwise, then sets `color: opts.color ?? null` (`:124`) and
  resolves a finite numeric `value` (`:23-26`, NaN → `null`). `pushPlot`
  validates via `validateEmission` and dedups last-write-wins per
  `(slotId, bar)` (runtime CLAUDE.md). The script-facing/compiler-injected
  overload seam branches on `typeof arg1 === "string"` (`:166-207`).
- **The validator gates the color styles.** `validateBgColorStyle`
  (`…/validateEmission.ts:371`) requires a non-empty color string and
  `transp ∈ [0, 100]` when present; `bar-color` routes through
  `validateSingleColorStyle` (`:435`). `validatePlotEmission` (`:447`)
  checks `value` is a finite number or `null` (`:456-459`).
- **The reference renderer paints both, ignoring `value`.**
  `renderBackgroundOverlays` (`…/createCanvas2dAdapter.ts:369`) →
  `drawBgColor` (`src/render/bgColor.ts:33`, fills a bar-wide band the full
  viewport height) reads `plot.style.color` + `plot.style.transp`;
  `renderBarOverlays` (`:385`) recolors the candle/bar from
  `plot.style.color`. Neither reads `PlotEmission.color` or `value` — the
  color is on the **style**, baked at emit time. Capabilities list both
  kinds (`src/capabilities.ts:38-39`). The adapter contract is
  `Adapter.onEmissions(RunnerEmissions)` (`adapter-kit/types.ts:834`), gated
  by `Capabilities.plots`.
- **Conformance pins these styles.** Four scenarios
  (`plotKind{BgColor,BarColor}{,Gated}.scenario.ts`, registered in
  `packages/conformance/src/index.ts:115-120`) assert a pinned `plot-hash`
  (e.g. bg-color `5fbfff9c…`, `plotKindBgColor.scenario.ts:15`) +
  `unsupported-plot-kind`/`malformed-emission` absence, and the gated
  variants assert the diagnostic when the capability is withheld. **The
  `plot-hash` hashes `{ bar, value }` only** (conformance CLAUDE.md) — adding
  a field to the wire tuple or reordering emission rebreaks every hash.
- **The converter emits `plot(Number.NaN, …)`.** `emitBackground`
  (`packages/pine-converter/src/transform/plotFamily.ts:349-359`) lowers
  `bgcolor(color)` / `barcolor(color)` to
  `plot(Number.NaN, { style: { kind: "bg-color"|"bar-color", color } })`
  — a STATIC color, because there is no dynamic-color target. `bgcolor` /
  `barcolor` are recognised Pine builtins (`semantic/builtins.ts:168-169`)
  and plot-family statements (`transform/plotFamily.ts:33-34`,
  `declaration.ts:22-23`).
- **The generated reference omits plotting entirely.**
  `scripts/generate-skills-reference.ts` `renderReference` (`:149-175`)
  emits only a `## ta.*` section and a `## draw.*` section — `plot` /
  `hline` / `bgcolor` / `barcolor` never appear in
  `skills/chartlang-coding/references/primitives.md`. Plotting is taught in
  `skills/chartlang-coding/SKILL.md` prose (`:252`) and
  `docs/spec/pine-migration.md` §8 (`:218-233`, the verbose
  `plot(bar.close, { style: { kind: "bg-color", … } })` form).
- **Docs.** `docs/spec/emissions.md:99-100` documents the `bg-color` /
  `bar-color` style validation rows; `docs/spec/pine-migration.md:218-233`
  (§8 "Visual Overrides") shows the verbose style form.

## Target State

### After Deliverable 1 (Tasks 1–3)

- `bgcolor(color, opts?)` and `barcolor(color, opts?)` are top-level core
  holes. `bgcolor("#1d4ed8", { transp: 80 })` is exact sugar for
  `plot(NaN, { style: { kind: "bg-color", color: "#1d4ed8", transp: 80 } })`;
  `barcolor("#a855f7")` sugars `plot(NaN, { style: { kind: "bar-color",
  color: "#a855f7" } })`. They reuse the **whole** landed pipeline — the same
  `bg-color`/`bar-color` `PlotStyle`, the same emission, the same validator,
  the same renderer, the same capability gate. No new emission kind, no new
  wire field, no renderer change.
- The compiler injects a callsite id into each `bgcolor`/`barcolor` call (new
  `STATEFUL_PRIMITIVES` entries) and lists each in `manifest.plots` with the
  right `kind` (`bg-color` / `bar-color`), exactly as it does for a
  `plot(…, { style: { kind } })` callsite — so host plot-overrides keep
  working.
- A no-`bgcolor`/no-`barcolor` script is byte-identical to today; an aliased
  call produces the **same wire emission** a verbose `plot(NaN, { style })`
  produces (the four conformance hashes are reusable as-is — see Task 3).
- `bgcolor` / `barcolor` are surfaced in the generated
  `primitives.md` (the generator gains a plot-family section) and taught in
  the chartlang-coding `SKILL.md`; `docs/spec/pine-migration.md` §8 shows the
  one-call alias alongside the verbose style.

### After Deliverable 2 (Tasks 4–6, product-gated)

- A first-class **per-bar dynamic-color value channel**: `bgcolor(close >
  open ? color.green : color.red)` (and `barcolor(...)`, and
  `plot(x, { color: cond ? green : red })`) recolors **every bar** by that
  bar's evaluated color in **one call**, with last-write-wins dedup per
  `(slotId, bar)` like every other emission.
- The channel is an **optional parallel `colorValue: Color | null`** on
  `PlotEmission` (the recommended design — see *Architecture Decisions*),
  NOT an overload of the numeric `value`. Omitted ⇒ byte-identical to a
  static-color emission, so existing conformance hashes stay valid and the
  wire-order invariant holds.
- Validation accepts a non-empty color string or `null`; the runtime resolves
  the alias/`plot` color argument (a `Color` scalar or a per-bar color
  expression) into `colorValue` per bar.
- **Every adapter** consumes `colorValue`: the reference renderer prefers
  `colorValue` over the static `style.color` when present; the adapter-kit
  contract documents the precedence. The Pine converter emits the **real
  dynamic color** (`bgcolor(close > open ? color.green : color.red)`) instead
  of `plot(Number.NaN, …)`.
- A new conformance scenario pins the dynamic-color channel (a `plot-field`
  assertion on `colorValue`, NOT a `plot-hash` change — `value` stays
  byte-identical so the numeric hash is untouched).

## Deliverable boundary

**Deliverable 1 is complete and shippable after Task 3.** It is pure sugar
over a landed pipeline + a generator/skill/doc surface — zero wire change,
zero renderer change, all four existing conformance hashes reusable.

**Deliverable 2 (Tasks 4–6) is gated on a product decision.** It is a
cross-layer change touching the wire, the validator, the dedup path, and
**every** adapter's `onEmissions` + the reference renderer, plus the
converter. Do not start Tasks 4–6 until the `colorValue`-vs-alternatives
decision (*Architecture Decisions*) is ratified. The two deliverables share
no files except `PlotEmission` (Task 4 adds an optional field) and the
converter (Task 6 changes `emitBackground`), so Deliverable 1 ships and
releases independently.

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **`bgcolor`/`barcolor` are pure sugar over the existing `plot(NaN, { style })` pipeline** | The whole `bg-color`/`bar-color` chain (style → wire → validate → render → capability gate → conformance) is already landed. Sugar adds zero new wire surface and inherits every existing test. The author writes one Pine-shaped call; the lowering is mechanical. |
| **They are new `STATEFUL_PRIMITIVES` entries (slot-injected), not bare functions** | A `bgcolor` callsite must get a stable `slotId` (host plot-overrides + last-write-wins dedup key) and be listed in `manifest.plots` with `kind: "bg-color"`, exactly like a styled `plot()`. Appending two registry entries is additive within `apiVersion: 1` (core CLAUDE.md). The compiler's `plotKindFromCallsite` learns the two callee names directly (no `style` object to read). |
| **`value` is `NaN` → resolves to `null` on the wire (Deliverable 1)** | Background/tint are not numeric series; the existing converter already emits `plot(Number.NaN, …)` and the runtime resolves non-finite to `null`. The alias passes no value at all — the lowering hard-codes the `NaN`. The numeric `value` channel is left untouched, preserving every `plot-hash`. |
| **Generated `primitives.md` gains a `## plot family` section** | Today the generator emits only `ta.*` / `draw.*` (it walks `STATEFUL_PRIMITIVES` for `ta.*` JSDoc and the `draw/` source tree). `plot`/`hline`/`bgcolor`/`barcolor` are core holes with full JSDoc but no generator path. Adding a third section (driven by the four core hole signatures) is the minimal way to make the aliases discoverable in the authoritative reference rather than prose-only. |
| **DELIVERABLE 2 — parallel `colorValue: Color \| null` channel (RECOMMENDED)** vs *overload numeric `value`* vs *new per-bar-color style arm* | **This is the hardest decision.** (1) **Overload the numeric `value`** to carry a string color — REJECTED: `value: number \| null` is load-bearing (alerts, y-scale, `plot-hash`, NaN-forbidden rule all assume numeric); widening it to `number \| string \| null` poisons every numeric consumer and the `plot-hash` tuple. (2) **A new `dynamic-color` style arm** carrying per-bar color — REJECTED for the general `plot(x, { color: cond ? … })` case: color-per-bar is orthogonal to *style*, so encoding it as a style splits one concept across N style arms and still cannot dynamically recolor a `line` plot. (3) **Add an optional parallel `colorValue: Color \| null`** to `PlotEmission` — RECOMMENDED: omitted ⇒ byte-identical to today (existing hashes hold, wire order unchanged because it appends), it is orthogonal to both numeric `value` and `style.color`, it serves `bgcolor`/`barcolor` AND ordinary value-plots uniformly, and it mirrors the proven optional-field-omitted-when-default pattern (`xShift`, `visible`, `z`). The static `style.color` stays the fallback; `colorValue` (when present) wins at render time. |
| **`colorValue` is a per-(slotId,bar) last-write-wins value, deduped like `value`** | The runtime already dedups plots per `(slotId, bar)`; `colorValue` rides the same emission and the same dedup, so a per-bar color is naturally one-value-per-bar. |
| **Converter emits real dynamic color only after Deliverable 2 lands** | Until the channel exists, `emitBackground` MUST keep emitting `plot(Number.NaN, { style })` (static color). Task 6 flips it to emit `bgcolor(<dynamic color expr>)` / `barcolor(...)` — gated behind Deliverable 2 so the converter never emits a construct the runtime can't carry. |

## Dependency Graph

```
DELIVERABLE 1 (ship now)
Task 1 (core: bgcolor/barcolor holes + opts types + registry + shim + type tests)
  |
  v
Task 2 (compiler: callsite-id injection + plotKindFromCallsite + manifest.plots + dep-graph)
  |
  v
Task 3 (primitives.md generator section + chartlang-coding skill + pine-migration §8)
  |  [DELIVERABLE 1 COMPLETE — shippable]
  |
  v   (product decision gate)
DELIVERABLE 2 (gated)
Task 4 (design + core/adapter-kit: colorValue channel on PlotEmission + author-side dynamic-color type)
  |
  v
Task 5 (runtime: resolve per-bar colorValue + validator + dedup)
  |
  v
Task 6 (every adapter: canvas2d colorValue precedence + adapter-kit contract + conformance + converter emits dynamic color)
```

## Task Summary Table

| # | Title | Package | Deliverable | Dependencies | Est. Complexity |
|---|-------|---------|-------------|--------------|-----------------|
| 1 | [Core `bgcolor`/`barcolor` holes + opts + registry + shim](./1-core-aliases.md) | core, compiler | 1 | None | Medium |
| 2 | [Compiler callsite handling + manifest.plots](./2-compiler-callsites.md) | compiler | 1 | 1 | Medium |
| 3 | [primitives.md generator + skill + docs](./3-surface-aliases.md) | scripts, skills, docs | 1 | 1, 2 | Medium |
| 4 | [Design + `colorValue` channel on the wire](./4-design-color-channel.md) | core, adapter-kit | 2 (gated) | 1 | High |
| 5 | [Runtime per-bar color resolve + validator + dedup](./5-runtime-color-resolve.md) | runtime, adapter-kit | 2 (gated) | 4 | High |
| 6 | [Adapters + conformance + converter dynamic color](./6-adapters-conformance-converter.md) | canvas2d-adapter, adapter-kit, conformance, pine-converter | 2 (gated) | 5 | High |

## Code Reuse

| Existing | Path | Use |
|----------|------|-----|
| `plot` / `hline` sentinel holes | `packages/core/src/plot/plot.ts:291` / `:307` | `bgcolor`/`barcolor` mirror the hole + JSDoc + throw pattern. |
| `bg-color` / `bar-color` `PlotOptsStyle` arms | `packages/core/src/plot/plot.ts:192` / `:201` | The lowering target — alias `transp`/`color` opts map onto these. |
| `STATEFUL_PRIMITIVES` registry | `packages/core/src/statefulPrimitives.ts` | Append `{ name: "bgcolor", slot: true }`, `{ name: "barcolor", slot: true }`. |
| `program.ts` ambient shim | `packages/compiler/src/program.ts` | Mirror the two holes + opts types in lockstep. |
| `callsiteIdInjection.ts` + `plotKindFromCallsite.ts` | `packages/compiler/src/transformers/` | Inject slot id + list `manifest.plots[*]` with `kind` for the two callees (`:140`, `:75-76`). |
| `extractDependencyGraph.ts` plot scan | `packages/compiler/src/analysis/extractDependencyGraph.ts:231` | Recognise `bgcolor`/`barcolor` as plot-producing callees alongside `plot`. |
| `buildStyle` + `plotImpl` overload seam | `packages/runtime/src/emit/plot.ts:28-131`, `:166-207` | Deliverable 1 needs NO runtime change (aliases lower to `plot` in core); Deliverable 2 extends `plotImpl` to set `colorValue`. |
| `validateBgColorStyle` / `validateSingleColorStyle` / `validateColor` | `…/validateEmission.ts:367-379`, `:435` | Deliverable 1 reuses as-is; Deliverable 2 adds a `colorValue` finite-color check (sibling to `xShift`). |
| `drawBgColor` + `renderBarOverlays` | `examples/canvas2d-adapter/src/render/bgColor.ts:33`, `…/createCanvas2dAdapter.ts:385` | Deliverable 2: prefer `colorValue` over `style.color`. |
| `plotKind{BgColor,BarColor}{,Gated}.scenario.ts` | `packages/conformance/src/scenarios/` | Deliverable 1: reuse pinned hashes for the alias (same wire). Deliverable 2: template for a `colorValue` scenario. |
| `emitBackground` | `packages/pine-converter/src/transform/plotFamily.ts:349-359` | Deliverable 1: switch to `bgcolor(...)`/`barcolor(...)` sugar emission. Deliverable 2: emit the dynamic color expression. |
| `renderReference` | `scripts/generate-skills-reference.ts:149-175` | Add a `## plot family` section. |

## Provenance

No `../invinite/` port. The `bg-color`/`bar-color` styles are
already-landed chartlang surface; the top-level `bgcolor`/`barcolor`
aliases and the dynamic-color channel are Pine-parity ergonomics on top of
them (Pine's global `bgcolor()` / `barcolor()` take a per-bar series color,
which is exactly the Deliverable-2 channel).

## Deferred / Follow-Up Work

- **`fill()` between two plots with a dynamic color** — Pine's
  `fill(plot1, plot2, color = …)` with per-bar color. Needs the same
  `colorValue` channel on the fill/`filled-band` emission; out of scope here.
- **Gradient-driven `bgcolor`** (a color that interpolates over a numeric
  range, Pine's `color.from_gradient`) — a value→color mapping primitive,
  orthogonal to the per-bar color channel; deferred.
- **`transp` as a per-bar dynamic channel** — Deliverable 2 carries a
  per-bar `colorValue` (color); a dynamic `transp` would be a second parallel
  channel. Fold the alpha into the color (`#RRGGBBAA`) for v1.
- **`bgcolor`/`barcolor` on a non-overlay pane** — Pine `bgcolor` is
  pane-scoped; the current renderer fills the price pane. Per-pane background
  routing is governed by pane layout, not this work.
