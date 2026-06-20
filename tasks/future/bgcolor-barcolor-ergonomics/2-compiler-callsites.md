# Task 2 — Compiler callsite handling + `manifest.plots` + runtime thin impl

> **Status: TODO**

> **Deliverable 1** (ergonomics tier — ships after Task 3).

## Goal

Teach the compiler to inject a callsite slot id into every `bgcolor` /
`barcolor` call (they are new `STATEFUL_PRIMITIVES` entries), list each in
`manifest.plots` with the right `kind` (`bg-color` / `bar-color`), and
recognise them as plot-producing callees in the dependency-graph scan. Wire
the thin runtime `bgcolor` / `barcolor` emit impls that build the existing
`bg-color` / `bar-color` style and dispatch to the landed `plotImpl`.

## Prerequisites

- Task 1 (core holes + registry entries + shim).

## Current Behavior

- `injectCallsiteIds` (`packages/compiler/src/transformers/callsiteIdInjection
  .ts`) resolves each call's callee name (`:119`), looks it up in
  `statefulByName` (`:120`), and — when `entry.slot` — mints a slot id via
  `callsiteIdFor` (`:122`) and injects it as the leading argument
  (`:158-161`). For `plot` / `hline` specifically (`:138-154`), it also
  pushes a `PlotSlotDescriptor` into `manifest.plots` carrying the `slotId`,
  the `kind` from `plotKindFromCallsite(calleeName, optsArg)` (`:145`), and an
  optional literal `title`.
- `plotKindFromCallsite` (`packages/compiler/src/transformers/
  plotKindFromCallsite.ts:71-87`) maps `hline` → `"horizontal-line"` (`:75`),
  reads `plot`'s `style.kind` literal (`:76-86`), and returns `undefined`
  (→ caller falls back to `"line"`) for any other callee.
- `extractDependencyGraph.ts:231` recognises `plot` as a plot-producing
  callee (`if (callee === "plot")`) when deciding whether an indicator
  produces plots.
- The runtime `plot` emit (`packages/runtime/src/emit/plot.ts`) exposes the
  dual `(value, opts?)` / `(slotId, value, opts?)` overload, builds the
  style via `buildStyle` (`:28-86`), capability-gates (`:96`), and emits via
  `pushPlot`. There is no `bgcolor` / `barcolor` runtime export.

## Desired Behavior

- A `bgcolor(...)` / `barcolor(...)` callsite gets a slot id injected as its
  leading argument, exactly like `plot` (the `callsite-id-conflict` /
  `stateful-call-element-access` guards apply uniformly via the registry
  lookup).
- Each `bgcolor` / `barcolor` callsite is listed in `manifest.plots` with
  `kind: "bg-color"` / `"bar-color"` and the literal `title` from its opts
  (so host plot-overrides key on the same `slotId` the runtime echoes).
- `extractDependencyGraph` treats `bgcolor` / `barcolor` as plot-producing
  callees (an indicator that only calls `bgcolor` still "produces plots").
- The runtime `bgcolor(slotId, color, opts?)` / `barcolor(slotId, color,
  opts?)` impls build the `bg-color` / `bar-color` style and dispatch to the
  existing `plotImpl` with `value = NaN` (→ resolves to wire `value: null`)
  and `opts.color = color`. The emitted `PlotEmission` is byte-identical to
  what `plot(NaN, { style: { kind: "bg-color", color, transp } })` produces
  today — same `slotId`, `style`, `value: null`, `color`.

## Requirements

### 1. `plotKindFromCallsite` — map the two callees (`plotKindFromCallsite.ts`)

Add, alongside the `hline` arm (`:75`):

```ts
if (calleeName === "bgcolor") return "bg-color";
if (calleeName === "barcolor") return "bar-color";
```

These callees carry no `style` object (the kind IS the callee), so they
return directly like `hline` — no opts-object scan.

### 2. `injectCallsiteIds` — list them in `manifest.plots` (`callsiteIdInjection.ts`)

Widen the plot-descriptor guard (`:138-140`):

```ts
if (
    plotSlots !== undefined &&
    (calleeName === "plot" ||
        calleeName === "hline" ||
        calleeName === "bgcolor" ||
        calleeName === "barcolor")
) {
```

`plotKindFromCallsite` now returns the right `kind` for the new callees
(Step 1). The `optsArg` for `bgcolor`/`barcolor` is `node.arguments[1]`
(same index as `plot`'s opts — the color is `arguments[0]`); `readLiteralTitle`
reads the literal `title` from it the same way. The slot-id injection path
(`:155-170`) is already generic over the callee — no change needed there
beyond the guard.

> **The slot id is minted ONCE and reused** for both the injected leading
> argument and the `manifest.plots[*].slotId` (compiler CLAUDE.md
> "`manifest.plots[*].slotId` must equal the injected callsite literal").
> The existing code already does this — do not re-derive.

### 3. `extractDependencyGraph` — recognise the producers (`extractDependencyGraph.ts:231`)

Widen the plot-producer check:

```ts
if (callee === "plot" || callee === "bgcolor" || callee === "barcolor") {
```

(`hline` may or may not already be in this scan — match whatever the existing
plot-producer predicate does; the point is `bgcolor`/`barcolor` count as
plot production.)

### 4. Runtime thin emit impls (`packages/runtime/src/emit/`)

Add `bgcolor` / `barcolor` runtime exports following the `emit/*` overload
seam (runtime CLAUDE.md "`emit/*` primitives ship as TypeScript-overloaded
functions exposing both `(value, opts?)` and `(slotId, value, opts?)`"):

- Script-facing overload: `bgcolor(color: Color, opts?: BgColorOpts): void`
  (always throws the active-step sentinel — no slotId).
- Compiler-injected overload: `bgcolor(slotId: string, color: Color, opts?:
  BgColorOpts): void`.
- Implementation: branch on `typeof arg1 === "string"`; when the active
  runtime context is present, dispatch to the **existing** `plotImpl` (or its
  shared internals) with:
  - `value = Number.NaN` (resolves to wire `value: null` via `resolveValue`),
  - `opts = { color, style: { kind: "bg-color", ...(transp) }, title }`.

  i.e. build the same `PlotOpts` a verbose `plot(NaN, { style })` would carry,
  then reuse `plotImpl` verbatim. Mirror for `barcolor` with `kind:
  "bar-color"` and no `transp`.

> **Reuse `plotImpl`, do NOT fork the emission path.** The capability gate,
> `buildStyle`, `pushPlot` validate + dedup, override application, and pane
> resolution must all run identically — `bgcolor`/`barcolor` are a thin
> adapter that constructs the `plot` arguments. Export `plotImpl` (or a
> small shared helper) from `emit/plot.ts` if it is currently file-private.

Register the two new exports on `ComputeContext` the same way `plot` /
`hline` are (`primitives.ts` / `buildComputeContext.ts` — follow the runtime's
existing wiring; preserve export identity per the runtime CLAUDE.md
`primitives.ts` swap-seam invariant).

### 5. Tests

- **Compiler** (`callsiteIdInjection.test.ts` / `compile.test.ts`): assert a
  `bgcolor(...)` callsite gets a slot-id leading argument injected, and
  `manifest.plots` lists it with `kind: "bg-color"` (and `bar-color` for
  `barcolor`) + the literal `title`. Assert `callsite-id-conflict` fires for
  two `bgcolor` calls sharing a slot id (mirrors the `plot` conflict test).
- **Runtime** (`emit/bgcolor.test.ts` / co-located): drive a compiled
  `bgcolor("#1d4ed8", { transp: 80 })` through the runtime and assert the
  drained `PlotEmission` equals the one a verbose `plot(NaN, { style: { kind:
  "bg-color", color: "#1d4ed8", transp: 80 } })` produces (same `slotId`,
  `style`, `value: null`, `color`). Assert the capability gate still emits
  `unsupported-plot-kind` when `bg-color` is withheld.
- **Runtime overload** (per the seam invariant): the bare script-facing
  `bgcolor("#000")` (no slotId) and any call with a null active context throw
  the active-step sentinel.

## Edge cases

- `bgcolor`/`barcolor` opts is `arguments[1]` (color is `arguments[0]`) —
  the `optsArg` index matches `plot`'s, so `plotKindFromCallsite` /
  `readLiteralTitle` reach the same node. Confirm.
- A dynamic / non-literal color argument is fine for Deliverable 1 — it rides
  through as `opts.color` (still a static string per bar in v1). The
  per-bar-recolor semantics are Deliverable 2.
- Do NOT change the `plot` / `hline` descriptor behavior — only widen the
  guard.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/compiler/src/transformers/plotKindFromCallsite.ts` | Modify | Map `bgcolor`→`bg-color`, `barcolor`→`bar-color`. |
| `packages/compiler/src/transformers/callsiteIdInjection.ts` | Modify | Widen the `manifest.plots` guard to the two callees. |
| `packages/compiler/src/analysis/extractDependencyGraph.ts` | Modify | Recognise the two plot-producing callees. |
| `packages/runtime/src/emit/plot.ts` | Modify | Export `plotImpl`/shared helper if file-private. |
| `packages/runtime/src/emit/bgcolor.ts` (+ `barcolor.ts`) | Create | Thin overloaded emit impls dispatching to `plotImpl`. |
| `packages/runtime/src/emit/index.ts` | Modify | Re-export the two impls. |
| `packages/runtime/src/primitives.ts` / `buildComputeContext.ts` | Modify | Bind `bgcolor` / `barcolor` on `ComputeContext`. |
| `packages/compiler/src/**/*.test.ts` | Modify | Injection + manifest tests. |
| `packages/runtime/src/emit/*.test.ts` | Create/Modify | Emission-equivalence + overload tests. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-compiler test`
- `pnpm -F @invinite-org/chartlang-runtime test` (100% coverage — the new
  emit impls' overload branches + active-step throws are asserted)
- `pnpm conformance` (no regression — the existing four bg/bar-color
  scenarios still pass unchanged; this task does NOT touch their hashes)

## Changeset

Covered by Task 1's shared Deliverable-1 changeset (`runtime` minor already
listed).

## Acceptance Criteria

- `bgcolor`/`barcolor` callsites get a slot id injected and are listed in
  `manifest.plots` with `kind: "bg-color"` / `"bar-color"` + literal title.
- `extractDependencyGraph` counts them as plot production.
- The runtime `bgcolor`/`barcolor` impls reuse `plotImpl` and emit a
  `PlotEmission` byte-identical to the verbose `plot(NaN, { style })` form.
- Overload seam holds: bare / null-context calls throw the sentinel.
- The four existing bg/bar-color conformance hashes are unchanged.
- typecheck/lint/compiler+runtime tests/conformance green.
