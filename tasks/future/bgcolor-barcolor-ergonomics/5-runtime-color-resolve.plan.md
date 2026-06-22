# Task 5 plan — Runtime per-bar `colorValue` resolve + validator + dedup

## Context

Deliverable 2 (RATIFIED). Task 4 already appended an optional parallel
`colorValue?: Color | null` to `PlotEmission` (adapter-kit), documented the
precedence contract (colorValue wins over static `style.color` at render —
render is Task 6), and added the wire JSDoc. Tasks 1/2 made bgcolor/barcolor
run end-to-end: the runtime `bgcolor`/`barcolor` impls build a `bg-color` /
`bar-color` style with a STATIC color and dispatch to `plotImpl`.

This task threads the per-bar color THROUGH the runtime: `bgcolor`/`barcolor`
route their color into `PlotEmission.colorValue` each bar; `validateEmission`
validates `colorValue` (non-empty color string OR `null`, sibling to the
`value` finite-or-null check); `colorValue` rides the existing
last-write-wins dedup per `(slotId, bar)`. Omitted ⇒ byte-identical wire.

## Pre-existing work (DO NOT TOUCH / build on)

- adapter-kit `PlotEmission.colorValue?: Color | null` — `packages/adapter-kit/src/types.ts:615`
  (Task 4). Build on it; do not redefine.
- adapter-kit CLAUDE.md "Wire + capability invariants" already documents the
  three-state colorValue contract (omitted / present / null) and says Task 5
  lands the runtime resolve + validation.
- runtime `bgcolor`/`barcolor` impls (Tasks 1/2) — `packages/runtime/src/emit/bgcolor.ts`,
  `barcolor.ts` — currently pass a STATIC `style.color` only.
- Other uncommitted features in the tree (state-array, multi-symbol-security)
  — out of scope; diff is bg-task-5-only.

## Design decision (from task Edge cases, confirmed against Task 4)

`bgcolor`/`barcolor` ALWAYS route their color through `colorValue` (their whole
purpose is per-bar color; they emit `value: null` so they never collided with
the numeric channel). Ordinary `plot(x, { color: "#fff" })` keeps using the
static top-level `color` field and does NOT emit `colorValue` — the plot wire
is untouched, so every existing plot golden / conformance hash holds.

Mechanism: `plotImpl` gains an optional 5th param `dynamicColor?: Color` (NOT
on the public `PlotOpts` — it is an internal channel between the alias impls
and `plotImpl`). `plot` does not pass it (static path, no `colorValue` →
byte-identical). `bgcolor`/`barcolor` pass their per-bar color. `plotImpl`
resolves it via a `resolveColor` helper (mirroring `resolveValue`): a
non-empty string → that string, else `null`; spreads it conditionally
`...(colorValue === undefined ? {} : { colorValue })` so the no-dynamic-color
path omits the field entirely.

The `bg-color`/`bar-color` style STILL carries the static color (fallback for
older adapters / Task-6 precedence). bgcolor/barcolor still emit `value: null`.

## Issues considered

- **Byte-identity break:** bgcolor/barcolor emissions now additionally carry
  `colorValue`, so the existing `bgcolor.test.ts` / `barcolor.test.ts`
  assertions that compare against a plain `plot(NaN, {style})` (which omits
  `colorValue`) will no longer be `toEqual`. These tests describe Deliverable-1
  behavior that Deliverable-2 intentionally extends. Update them: the aliased
  emission now equals the verbose plot PLUS `colorValue`, and add explicit
  colorValue assertions. The Deliverable-1 INTENT (style/value/title/pane
  identical) is preserved via field-level assertions.
- **Plot path untouched:** verbose `plot(NaN, {style:{kind:"bg-color"}})` in
  `plot.test.ts` does NOT route through `colorValue` (no `dynamicColor` arg),
  so those stay byte-identical. Confirmed plot.golden/property tests carry no
  bg-color/colorValue refs.
- **Validator branch coverage:** new arm has 3 live branches (present-valid,
  present-invalid→bad, null/undefined skip). Cover all in
  `validateEmission.test.ts`.
- **`Color` import in validator:** reuse the existing `validateColor` helper
  (already non-empty-string). No new import needed; `colorValue` is read as
  `e.colorValue` (unknown) and narrowed.

## Steps

1. `packages/runtime/src/emit/plot.ts`:
   - Add `resolveColor(color: Color): Color | null` helper after `resolveValue`
     (`:23-26`): non-empty string → color, else `null`.
   - Add optional `dynamicColor?: Color` param to `plotImpl` (after `opts`).
   - Compute `colorValue = dynamicColor === undefined ? undefined : resolveColor(dynamicColor)`
     and spread `...(colorValue === undefined ? {} : { colorValue })` as the
     LAST field of the emission (after `z`), mirroring the appended wire order.
   - Update `plotImpl` JSDoc to mention the dynamic-color channel.
2. `packages/runtime/src/emit/bgcolor.ts`: pass `arg2` (the color) as the new
   `dynamicColor` arg to `plotImpl`. Update file JSDoc (no longer
   byte-identical to verbose plot — now carries `colorValue`).
3. `packages/runtime/src/emit/barcolor.ts`: same.
4. `packages/adapter-kit/src/validation/validateEmission.ts`: in
   `validatePlotEmission`, after the `value` check (`:457-460`), validate
   `colorValue` (present-non-null → `validateColor`; null/undefined skip).
5. Tests:
   - `bgcolor.test.ts` / `barcolor.test.ts`: update equivalence tests; add
     per-bar (cond flips) colorValue, dedup last-write-wins, and explicit
     colorValue assertions. Static literal still emits a `colorValue` (it's a
     bgcolor — the per-bar channel) but `null`/empty resolves to `null`.
   - `plot.test.ts`: assert a verbose `plot(NaN,{style:{kind:"bg-color"}})`
     omits `colorValue` (plot path unchanged); assert `plotImpl` dynamicColor
     param resolves/dedups (via bgcolor) — covered by alias tests.
   - `validateEmission.test.ts`: `colorValue` "#fff" passes, null passes,
     undefined passes, "" / non-string → malformed-emission (dropped).
6. `packages/runtime/CLAUDE.md`: add invariant note for the colorValue resolve
   + omit-when-no-dynamic-color + dedup.

## Files

| File | Action |
|------|--------|
| `packages/runtime/src/emit/plot.ts` | Modify — `resolveColor` + `dynamicColor` param + conditional `colorValue` spread |
| `packages/runtime/src/emit/bgcolor.ts` | Modify — pass color to `colorValue` |
| `packages/runtime/src/emit/barcolor.ts` | Modify — pass color to `colorValue` |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify — validate `colorValue` |
| `packages/runtime/src/emit/bgcolor.test.ts` | Modify — per-bar / dedup / colorValue |
| `packages/runtime/src/emit/barcolor.test.ts` | Modify — per-bar / dedup / colorValue |
| `packages/runtime/src/emit/plot.test.ts` | Modify — plot path omits colorValue |
| `packages/adapter-kit/src/validation/validateEmission.test.ts` | Modify — colorValue validation |
| `packages/runtime/CLAUDE.md` | Modify — colorValue invariant |

## Gates to keep green

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-runtime test` (100% coverage)
- `pnpm -F @invinite-org/chartlang-adapter-kit test` (100% coverage on new arm)
- Existing plot goldens/hashes MUST NOT move (plot path never sets colorValue).

## Changeset

Extend `.changeset/bgcolor-barcolor.md` (runtime already `minor`; adapter-kit
add as `minor`). Mention Deliverable-2 runtime colorValue resolve + validate.

## Acceptance criteria

- `plotImpl` resolves + conditionally emits `colorValue`; static-only (plot)
  emissions omit it (byte-identical).
- `bgcolor`/`barcolor` carry the live per-bar color via `colorValue`.
- `validateEmission` accepts color-or-null `colorValue`, drops malformed.
- Dedup collapses `colorValue` last-write-wins per `(slotId, bar)`.
- Runtime + adapter-kit 100% coverage; plot goldens/hashes unchanged.
