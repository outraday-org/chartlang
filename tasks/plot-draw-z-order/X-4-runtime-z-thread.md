# Tier 3 (runtime): Thread `z` to Plot & Drawing Emissions

> **Status: TODO**

## Goal

Read `opts.z` in the runtime's plot-emit and drawing-emit paths and
write it onto `PlotEmission.z` / `DrawingEmission.z`, **omitting the
field when `z === 0` or undefined** so a no-z emission stays
byte-identical to the pre-feature baseline. Mirror the `xShift`
conditional-spread pattern.

## Prerequisites

- Task 2 (`PlotOpts.z` / draw options `z` exist).
- Task 3 (`PlotEmission.z` / `DrawingEmission.z` + validation exist).

## Current Behavior

`packages/runtime/src/emit/plot.ts:88` `plotImpl` builds the emission and
threads `xShift` via the omit-when-`0` pattern:

```ts
const xShift = typeof value === "number" ? 0 : seriesOffsetOf(value);
const emission: PlotEmission = {
    kind: "plot",
    slotId,
    title: opts.title ?? "",
    style,
    bar: ctx.barIndex(),
    time: ctx.stream.bar.time,
    value: resolveValue(value),
    color: opts.color ?? null,
    meta: {},
    pane,
    ...(xShift === 0 ? {} : { xShift }),
};
```

The drawing-emit path is **centralized** in
`packages/runtime/src/emit/draw/handle.ts`: every `draw.*` constructor
routes through `createDrawingHandle()`, whose `emit()` builds the single
`DrawingEmission` shape `{ kind, handleId, drawingKind, op, state, bar,
time }` and per-handle state lives in `ctx.drawingSlots`
(`Map<string, { kind, state, removed }>`). Style fields (`color`,
`lineWidth`, …) persist **inside `state.style`** (merged across `update`
via `mergeState`). So `z` only needs threading in this **one** file — not
across the ~92 per-kind draw implementations.

## Desired Behavior

- `plotImpl` reads `opts.z` (a direct option now, **not** a series tag
  like `offset`), normalizes undefined → `0`, and appends
  `...(z === 0 ? {} : { z })`.
- The drawing-emit path reads the drawing call's `z` option and appends
  `...(z === 0 ? {} : { z })` to each `DrawingEmission` it produces
  (create/update/remove — see dedup note).
- No change to values, geometry, alerts, or dedup keys.

## Requirements

### 1. Plot path — `packages/runtime/src/emit/plot.ts`

`z` is a **plot option**, unlike `xShift` (which is derived from the
series via `seriesOffsetOf`). Read it straight from `opts`:

```ts
const z = opts.z ?? 0;
const emission: PlotEmission = {
    // …existing fields…
    pane,
    ...(xShift === 0 ? {} : { xShift }),
    ...(z === 0 ? {} : { z }),
};
```

- Validate/normalize: if `opts.z` is provided, it has already passed the
  author-type check (number). Runtime does not need to re-reject
  non-finite here (the emission validator in Task 3 is the guard for
  hosts) — but if the runtime has a `dev`-mode invariant assertion path
  for `xShift`, add the equivalent for `z` (finite-number assert) to
  match the existing rigor. Otherwise leave validation to
  `validateEmission`.
- `applyPlotOverride` (`packages/runtime/src/emit/applyPlotOverride.ts`)
  only rewrites `visible`/`color`/`lineWidth`/`lineStyle` and spreads the
  rest of the emission through, so it does **not** strip `z` today — no
  code change needed there. Keep the override-preservation test (Req 3)
  as a regression guard in case that function is later tightened.

### 2. Drawing path — `packages/runtime/src/emit/draw/handle.ts`

Thread the call's `z` option onto the `DrawingEmission` built by
`emit()`. **Critical:** `z` is a **top-level** `DrawingEmission` field
(Task 3), **not** part of `state` / `state.style` (which is
`DrawingState` and goes on the wire as `state`). So do **not** merge `z`
into `state.style` the way `color`/`lineWidth` are merged — that would
leak `z` into `DrawingState`, which Task 3 forbids. Instead:

- Extract `z` from the draw call's `opts` in `createDrawingHandle()`.
- Persist it in the handle record (`ctx.drawingSlots` entry — extend it
  to `{ kind, state, z, removed }`) so an `update` that does not
  re-specify `z` retains the last value (parallel to how style persists,
  but stored **beside** `state`, not inside it).
- In `emit()`, append `...(z === 0 ? {} : { z })` to the top-level
  emission object, for both `create` and `update`.
- `remove` does not need `z` (no render); appending the omit-when-0
  spread is harmless — pick one and document the choice.

### 3. Tests (co-located, §16.3 runtime layers)

- **Unit:** `plot(v, { z: 2 })` → emission has `z: 2`;
  `plot(v, { z: 0 })` and `plot(v)` → emission has **no** `z` key
  (assert via `"z" in emission` / `Object.keys`). Same for `draw.line(a,
  b, { z: -1 })` → `z: -1`; default → no key.
- **Byte-identity / golden:** an existing plot/draw golden run with no
  `z` must remain bit-identical (no new key). Add a focused assertion if
  the golden harness doesn't already cover key-set equality.
- **Persistence:** a drawing created with `z` then `update`d without
  re-specifying `z` retains the original `z` (if persistence applies).
- **Override:** a host plot-override on a `z`-bearing slot preserves
  `z`.

### 4. Edge cases / invariants

- `z` and `xShift` are independent; a plot may carry both. Test the
  combination (`{ offset: 3 }` series + `{ z: 2 }`) → emission has both
  `xShift: 3` and `z: 2`.
- Dedup keys (`(slotId, bar)` / `(handleId, bar)`) are unchanged — `z`
  is not part of any key.
- No compiler interaction: `z` is a pass-through option.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/emit/plot.ts` | Modify | Thread `opts.z` → `PlotEmission.z` (omit-when-0) |
| `packages/runtime/src/emit/draw/handle.ts` | Modify | Thread draw `z` → top-level `DrawingEmission.z` (omit-when-0); persist `z` in the `ctx.drawingSlots` record, **not** in `state.style` |
| `packages/runtime/src/emit/*.test.ts` (+ draw tests) | Modify | Unit + byte-identity + persistence + combo |
| `packages/runtime/CLAUDE.md` | Modify | Note `z` emission threading + omit-when-0 invariant |
| `.changeset/plot-draw-z-order.md` | Modify | Append `@invinite-org/chartlang-runtime: minor` |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (coverage 100% on `packages/runtime`)
- `pnpm docs:check`
- `pnpm bench:ci` (if the plot/draw emit is on the benched hot path —
  the conditional spread is O(1); confirm no regression)

## Changeset

Append `"@invinite-org/chartlang-runtime": minor` to
`.changeset/plot-draw-z-order.md` and extend the body to note runtime
threading.

## Acceptance Criteria

- `plot()` and `draw.*()` with `z` produce emissions carrying `z`;
  default/`0` produce **no** `z` key (byte-identical baseline), proven
  by tests.
- `z` persists across drawing `update`s; host overrides preserve `z`;
  `z`+`xShift` combination works.
- Dedup keys unchanged; no golden drift for no-`z` scripts.
- 100% coverage on `packages/runtime`; gates green.
- Changeset updated; `packages/runtime/CLAUDE.md` updated.
