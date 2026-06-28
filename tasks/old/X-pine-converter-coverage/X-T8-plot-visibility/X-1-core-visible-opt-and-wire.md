# Task 1 — Core `PlotOpts.visible` authoring opt (wired into the existing `PlotEmission.visible` field)

> **Status: TODO**

## Goal

Add a per-plot **authoring** visibility opt — an optional `visible?: boolean`
on `PlotOpts` (core) — and mirror it in the compiler ambient shim. This task
adds **only** the authoring type; the runtime resolution that feeds it into the
emission is Task 3, the adapter consumption is Task 4.

> **IMPORTANT — the wire field already exists; do NOT re-add it.**
> `PlotEmission.visible?: boolean` is already defined in
> `packages/adapter-kit/src/types.ts` (**@since 0.8, @stable**), is already
> validated by `validateEmission` (`plot.visible: must be a boolean`), and is
> already populated by the runtime's **host-override** path
> (`packages/runtime/src/emit/applyPlotOverride.ts` sets `visible: false` from
> `PlotOverride.visible`). The reference canvas2d adapter already skips a
> `plot.visible === false` emission (`createCanvas2dAdapter.ts`). What is MISSING
> is the **authoring** channel: a script writing `plot(x, { visible: false })`
> has no `PlotOpts.visible` opt, and the runtime emit path (`plot.ts`) does not
> read it. T8 wires the authoring opt into the SAME existing
> `PlotEmission.visible` field — it does NOT introduce a new wire field. The
> omit-when-visible / byte-identical-when-absent guarantee is already in place
> (host overrides only ever write `false`); the authoring path follows the same
> rule.

## Prerequisites

None.

## Current Behavior

- `PlotOpts` (`packages/core/src/plot/plot.ts`) carries `color`, `title`,
  `lineWidth`, `lineStyle`, `fill`, `z` — there is **no** `visible` / `display`
  field. **This is the only missing surface.**
- `PlotEmission` (`packages/adapter-kit/src/types.ts`, the wire) **ALREADY has
  `readonly visible?: boolean` (@since 0.8, @stable)** — "Omitted ⇒ visible. Set
  to `false` by the runtime when a host override hides this slot." So the wire
  field, its omit-when-visible semantics, and the adapter obligation are already
  defined. There is also a host-side `PlotOverride.visible` (@since 0.8).
- `validateEmission` (`packages/adapter-kit/src/validation/validateEmission.ts`)
  **already validates** `plot.visible` is a boolean.
- The optional-field-omitted-when-default pattern is in place (`z`, `xShift`,
  `visible`) — keeping `apiVersion: 1` snapshots byte-identical when unused.
- `packages/compiler/src/program.ts` ambient shim mirrors `PlotOpts` and must
  stay in lockstep with core (it needs the NEW `PlotOpts.visible`).

## Desired Behavior

```ts
// authoring (inside compute):
plot(maSlope, { visible: showSlope });          // constant boolean toggle
plot(rsi, { visible: false });                  // hidden plot
plot(close);                                    // unchanged → no wire field

// wire (adapter-kit PlotEmission), conceptually:
{ slotId, bar, value }                          // visible omitted ⇒ visible
{ slotId, bar, value, visible: false }          // explicitly hidden
```

- `visible` is an optional `boolean`. **Absent or `true` ⇒ visible** (the
  default); only `false` is carried on the wire.
- v1 supports a **constant boolean** (Trend Wizard toggles on input booleans).
  A per-bar `Series<boolean>` channel is a documented follow-up (see Deferred).

## Requirements

### 1. `PlotOpts.visible` (`packages/core/src/plot/plot.ts`)

Add the field to `PlotOpts` with full JSDoc:

```ts
/**
 * Whether this plot is drawn. `false` hides the plot entirely; omitted or
 * `true` draws it. Hiding suppresses the mark — it is NOT the same as
 * plotting `NaN` (which breaks line continuity / fills). Mirrors Pine's
 * `display = display.all | display.none`.
 *
 * @since 1.4
 * @stable
 */
visible?: boolean;
```

Keep it `readonly` if `PlotOpts` fields are `readonly` (match the surrounding
shape). Do **not** add `visible` to `HLineOpts` in this task (hlines are
constant guides; out of scope — list in Deferred).

### 2. `PlotEmission.visible` — NO CHANGE (already exists)

`PlotEmission.visible?: boolean` already exists in
`packages/adapter-kit/src/types.ts` (@since 0.8, @stable) and
`validateEmission` already validates it. **Do not re-add or re-document it
here.** The authoring opt (Requirement 1) reuses this exact field via the
runtime wiring in Task 3. This means **adapter-kit needs no source change in
T8** (its visibility surface is complete) — see the Changeset note.

### 3. Compiler ambient shim (`packages/compiler/src/program.ts`)

Add `visible?: boolean;` to the shim's `PlotOpts` declaration, byte-consistent
with core. No other shim change.

### 4. Type-level tests

- **Core** (`packages/core/src/plot/*.types.test.ts`): assert
  `plot(x, { visible: false })` type-checks and `visible` is `boolean | undefined`.
- **adapter-kit**: the `PlotEmission.visible` type + its validator test already
  exist (`validateEmission.test.ts` covers `visible: false`/`true`/non-boolean)
  — no new adapter-kit test needed in this task.

### 5. Changeset

Create `.changeset/<slug>.md` — the **shared** feature changeset for the whole
T8 work:

```md
---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-pine-converter": patch
---

Add a per-plot authoring `visible` opt — `plot(x, { visible })` (and Pine
`display = display.all | display.none` conversion). Wired into the existing
`PlotEmission.visible` wire field; omitted when visible so existing emissions
stay byte-identical. (adapter-kit needs no change — its `visible` wire field +
validator already exist @since 0.8.)
```

## Edge cases

- `visible: true` MUST be treated identically to omitted — the runtime (Task 3)
  drops the field when `true`/absent.
- Do NOT touch `value`, `color`, `style`, or the wire field ORDER (append only).
- `@since 1.4` — confirm the current core version and adjust if it has moved.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/plot/plot.ts` | Modify | Add `PlotOpts.visible`. |
| `packages/adapter-kit/src/types.ts` | No change | `PlotEmission.visible` already exists (@since 0.8). |
| `packages/compiler/src/program.ts` | Modify | Mirror `visible` in shim `PlotOpts`. |
| `packages/core/src/plot/*.types.test.ts` | Modify/Create | Core type test. |
| `.changeset/<slug>.md` | Create | Shared T8 feature changeset (no adapter-kit bump). |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-core test`
- `pnpm -F @invinite-org/chartlang-adapter-kit test`
- `pnpm -F @invinite-org/chartlang-compiler test`
- `pnpm docs:check` (JSDoc on new fields)

## Changeset

`.changeset/<slug>.md` — **minor** (core, compiler, runtime) + **patch**
(pine-converter). Shared across all T8 tasks. **No adapter-kit bump** — its
`visible` wire field + validator already exist.

## Acceptance Criteria

- `PlotOpts.visible` defined, JSDoc'd, exported; shim mirrors core.
  `PlotEmission.visible` is reused unchanged (no adapter-kit edit).
- Omitting `visible` leaves `PlotEmission` byte-identical to today.
- Core type test proves the authoring surface; typecheck/lint/core+compiler
  tests/docs:check green.
