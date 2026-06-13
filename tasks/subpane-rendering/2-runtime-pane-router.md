# Task 2 — Runtime pane router + hline pane support

> **Status: TODO**

## Goal

Replace the Phase-1 fold in `paneResolver.ts` with a real pane router
that consults `RuntimeContext.defaultPane` (set from
`manifest.overlay`) and the adapter's `capabilities.subPanes` to
return the resolved pane key on `PlotEmission.pane`. Wire `hline()`
through the same router so horizontal lines route to subpanes too.

## Prerequisites

Task 1 (`overlay` on the manifest + `HLineOpts.pane`).

## Current Behavior

- `packages/runtime/src/emit/paneResolver.ts:23-50` — return type is
  `"overlay"`. Every non-overlay request is folded to overlay with
  an `unsupported-pane` diagnostic. Two branches differ only in the
  diagnostic message.
- `packages/runtime/src/runtimeContext.ts:113-240` — `RuntimeContext`
  has no pane-related fields. The manifest is read at mount by
  `createScriptRunner` but no pane signal is propagated.
- `packages/runtime/src/emit/hline.ts:41` — `pane: "overlay"` is a
  hard-coded literal on every `hline()` emission.
- `paneResolver.test.ts:75-93` — tests pin the fold behaviour.

## Desired Behavior

- `RuntimeContext` gains `readonly defaultPane: string` and
  `readonly scriptPane: string`. The runner resolves them at mount:
  - `manifest.overlay !== false` → `"overlay"`.
  - `manifest.overlay === false` → `"script:<sanitised-name>"` where
    `sanitised-name` is `manifest.name` with `/[^a-zA-Z0-9_-]/g`
    replaced by `-`. Empty / all-stripped name falls back to
    `"script:default"`.
  - `scriptPane` is always the stable `"script:<sanitised-name>"`
    key, even when `defaultPane === "overlay"`. Explicit
    `pane: "new"` uses this key so a script gets one joined subpane,
    not one subpane per plot callsite.
- `resolvePane(requested, ctx, slotId)` returns:
  - `requested === "overlay"` → `"overlay"`.
  - `requested === undefined` → `ctx.defaultPane`.
  - `requested === "new"` → `ctx.scriptPane` (one stable subpane per
    script).
  - any other string and `capabilities.subPanes >= 1` → that string,
    unchanged.
  - any non-overlay string and `capabilities.subPanes === 0` → fold
    to `"overlay"` with the existing `unsupported-pane` diagnostic
    (the bare-bones adapter compat path).
- `hline()` (`packages/runtime/src/emit/hline.ts`) reads
  `opts.pane`, calls `resolvePane`, emits the resolved pane on the
  `PlotEmission`.
- The diagnostic for the `subPanes: 0` branch retains its existing
  code (`unsupported-pane`) and message format.
- `paneResolver.test.ts` covers the new routing matrix; a sibling
  property test exercises arbitrary requested strings × subPanes
  values.

## Requirements

### 1. `packages/runtime/src/runtimeContext.ts` — add pane fields

Add the fields after `resolvedInputs` (~line 228):

```ts
/**
 * Mount-time script pane default. The runner sets it from
 * `manifest.overlay`:
 *   - `overlay` absent / `true` → `"overlay"`.
 *   - `overlay === false` → `"script:<sanitised(manifest.name)>"`.
 * `resolvePane` reads this value when a `plot()` / `hline()` call
 * has no explicit `pane` opt, or requests `"new"`.
 * @since 0.2
 */
readonly defaultPane: string;

/**
 * Stable non-overlay pane key for this script. Explicit
 * `pane: "new"` resolves here even when `defaultPane === "overlay"`
 * so every `"new"` plot in a script joins one script-owned subpane.
 * @since 0.2
 */
readonly scriptPane: string;
```

Fields are `readonly` — once mount-time-resolved, the runner does not
mutate them.

### 2. `packages/runtime/src/createScriptRunner.ts` — resolve at mount

Add small helpers (file-private):

```ts
const SANITISE_PANE_KEY = /[^a-zA-Z0-9_-]/g;
function resolveScriptPane(manifest: ScriptManifest): string {
    const sanitised = manifest.name.replace(SANITISE_PANE_KEY, "-");
    return `script:${sanitised === "" ? "default" : sanitised}`;
}

function resolveDefaultPane(manifest: ScriptManifest): string {
    return manifest.overlay === false ? resolveScriptPane(manifest) : "overlay";
}
```

Pass both results into the `RuntimeContext` construction site. The
fields are `readonly` so they get set inside the literal — no
post-hoc assignment.

### 3. `packages/runtime/src/createScriptRunner.test.ts` — defaultPane tests

Add four cases:

- `overlay: true` manifest → `runner.context.defaultPane === "overlay"`.
- `overlay: false` manifest + `name: "RSI Cross"` →
  `runner.context.defaultPane === "script:RSI-Cross"`.
- `overlay: false` manifest + `name: "$$$"` (all chars sanitised) →
  `runner.context.defaultPane === "script:default"`.
- `overlay: true` manifest + `name: "RSI Cross"` still sets
  `runner.context.scriptPane === "script:RSI-Cross"`.

(Use the existing test harness's `createTestRunner` /
`mountTestRunner` helper — match whichever pattern the file already
uses.)

### 4. `packages/runtime/src/emit/paneResolver.ts` — rewrite

Replace the body. Return type widens from `"overlay"` to `string`:

```ts
export function resolvePane(
    requested: string | undefined,
    ctx: RuntimeContext,
    slotId: string,
): string {
    if (requested === "overlay") return "overlay";

    // No explicit pane — fall back to the script's mount-time default.
    if (requested === undefined) return ctx.defaultPane;

    // `"new"` coalesces to the stable script-owned pane. This avoids
    // one subpane per plot callsite while still letting overlay-default
    // scripts opt one plot into a subpane.
    if (requested === "new") {
        return resolveNamedPane(ctx.scriptPane, ctx, slotId);
    }

    return resolveNamedPane(requested, ctx, slotId);
}

function resolveNamedPane(
    pane: string,
    ctx: RuntimeContext,
    slotId: string,
): string {
    if (ctx.capabilities.subPanes >= 1) return pane;
    pushDiagnostic(ctx.emissions, {
        kind: "diagnostic",
        severity: "warning",
        code: "unsupported-pane",
        message: `Adapter declares subPanes: 0; pane "${pane}" folded to overlay.`,
        slotId,
        bar: ctx.barIndex(),
    });
    return "overlay";
}
```

The JSDoc on `resolvePane` is rewritten — drop the "Phase 1 folds
everything to overlay" wording; document the four branches.

### 5. `packages/runtime/src/emit/paneResolver.test.ts` — rewrite tests

Replace the existing fold-tests with:

- `requested === undefined` + `overlay`-default ctx → returns
  `"overlay"`, no diagnostic.
- `requested === undefined` + `script:rsi`-default ctx + `subPanes:
  1` → returns `"script:rsi"`, no diagnostic.
- `requested === "overlay"` always returns `"overlay"`, no
  diagnostic, regardless of `subPanes`.
- `requested === "new"` + `overlay`-default ctx + `subPanes: 1` →
  returns `"script:<sanitised>"`, no diagnostic.
- `requested === "new"` + `script:rsi`-default ctx + `subPanes: 1`
  → returns `"script:rsi"`, no diagnostic.
- `requested === "rsi"` + `subPanes: 1` → returns `"rsi"`, no
  diagnostic.
- `requested === "rsi"` + `subPanes: 0` → returns `"overlay"`,
  pushes the `unsupported-pane` warning (covers the bare-bones
  adapter fallback path).
- `requested === "new"` + `overlay`-default ctx + `subPanes: 0` →
  returns `"overlay"`, pushes diagnostic (the `script:<id>` path
  flows through `resolveNamedPane` which folds).

Update `makeCtx` to accept `defaultPane` (default `"overlay"`) and
`scriptPane` (default `"script:test"`).

### 6. `packages/runtime/src/emit/paneResolver.property.test.ts` — new file

`fast-check` property: for every `requested ∈ string ∪ undefined`
and every `subPanes ∈ {0, 1, MAX_SAFE_INTEGER}`, the resolver
returns a non-empty string and pushes at most one diagnostic per
call. Pin the seed via `vitest.setup.ts` (no per-test override).

### 7. `packages/runtime/src/emit/hline.ts` — route through resolver

Today the file emits `pane: "overlay"` directly. Change:

```ts
import { resolvePane } from "./paneResolver.js";
// ...
function hlineImpl(
    ctx: RuntimeContext,
    slotId: string,
    price: number,
    opts: HLineOpts,
): void {
    const pane = resolvePane(opts.pane, ctx, slotId);
    const emission: PlotEmission = {
        kind: "plot",
        slotId,
        title: opts.title ?? "",
        style: {
            kind: "horizontal-line",
            lineWidth: opts.lineWidth ?? 1,
            lineStyle: opts.lineStyle ?? "solid",
        },
        bar: ctx.barIndex(),
        time: ctx.stream.bar.time,
        value: price,
        color: opts.color ?? null,
        meta: {},
        pane,
    };
    pushPlot(ctx.emissions, emission);
}
```

Drop the old "`hline` is fixed to `pane: \"overlay\"`" JSDoc paragraph;
the new behaviour is "follows the same router as `plot()` — see
{@link resolvePane}". Keep the `@since`, `@example`, `@stable` tags.

### 8. `packages/runtime/src/emit/hline.test.ts` — new pane assertions

Add:

- `hline(70)` on an `overlay: true` mount emits `pane === "overlay"`.
- `hline(70)` on an `overlay: false` mount emits `pane ===
  "script:<sanitised>"`.
- `hline(70, { pane: "rsi" })` on either mount + `subPanes >= 1`
  emits `pane === "rsi"`.
- `hline(70, { pane: "rsi" })` on `subPanes: 0` falls back to
  overlay + pushes the warning.

### 9. `packages/runtime/src/emit/plot.ts` — no behavioural change

`plot.ts` already calls `resolvePane(opts.pane, ctx, slotId)`
(line 106). The widened return type (`string`) flows through; no
edit needed. Spot-check the existing `plot.test.ts` cases:

- `plot(close)` on `overlay: true` continues to emit
  `pane === "overlay"`.
- `plot(close)` on `overlay: false` now emits the script pane key
  (was `"overlay"` before the lift).

The latter is a behavioural change. Update or add the test case.

### 10. `packages/runtime/src/emit/plot.test.ts` — default-pane test

Add a case asserting `plot(42)` on an `overlay: false` mount with
`subPanes >= 1` emits `pane === "script:<sanitised>"`. (If the
existing default-pane case asserted `pane === "overlay"` for the
default-no-flag mount, that assertion stays valid — confirm.)

### Edge cases

- **`overlay: true` is preserved but routes to overlay** — Task 1
  stores the flag faithfully; the runtime treats `true` as "overlay
  default" identical to absence. Don't introduce a third state.
- **`manifest.name` with `:` in it (e.g. "RSI:14")** — sanitiser
  replaces `:` so the pane key cannot collide with the
  `script:` prefix structure. Property test covers arbitrary names.
- **Empty `manifest.name`** — sanitiser yields `""`; fallback to
  `"script:default"`. Covered by the createScriptRunner test.
- **Persisted-state warm start** — `defaultPane` is mount-time-
  resolved from the manifest, so warm-restart does not re-derive
  it; this is correct because the manifest is the source of truth.
- **`onBarTick` path** — `resolvePane` is called per emit during
  tick steps too; no extra wiring needed because `ctx.defaultPane`
  is already on the per-step context.
- **Coverage gate** — the rewritten resolver has 4 distinct
  branches × 2 subPanes states = 8 paths. The unit tests plus the
  property test cover every branch.
- **§16.3 test layers** — `paneResolver` gains the property test
  (was unit-only). `hline` keeps its existing unit suite; the new
  pane cases extend it. No new bench is required — the resolver is
  a constant-time function.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/runtimeContext.ts` | Modify | Add `readonly defaultPane: string` + `readonly scriptPane: string` |
| `packages/runtime/src/createScriptRunner.ts` | Modify | Resolve `defaultPane` and `scriptPane` at mount from `manifest.overlay` / `manifest.name` |
| `packages/runtime/src/createScriptRunner.test.ts` | Modify | Tests for the three default-pane branches |
| `packages/runtime/src/emit/paneResolver.ts` | Modify | Rewrite — real router; widen return type to `string` |
| `packages/runtime/src/emit/paneResolver.test.ts` | Modify | Replace fold-tests with router-tests |
| `packages/runtime/src/emit/paneResolver.property.test.ts` | Create | `fast-check` property over requested × subPanes |
| `packages/runtime/src/emit/hline.ts` | Modify | Read `opts.pane`, route through `resolvePane` |
| `packages/runtime/src/emit/hline.test.ts` | Modify | New pane-routing cases |
| `packages/runtime/src/emit/plot.test.ts` | Modify | Default-pane test for `overlay: false` mounts |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm -F @invinite-org/chartlang-runtime test` (coverage 100%)
- `pnpm docs:check`

## Changeset

`.changeset/subpane-2-runtime-router.md` —
`@invinite-org/chartlang-runtime` gets a `minor` bump. The change
is observably additive for `overlay: true` / no-`overlay`
scripts; `overlay: false` scripts now emit a non-overlay pane
string, which is the explicit intent of the feature.

## Acceptance Criteria

- `RuntimeContext.defaultPane` and `RuntimeContext.scriptPane` are set
  at mount; overlay-true, overlay-false-named,
  overlay-false-empty-name, and overlay-true-scriptPane branches are
  asserted.
- `resolvePane` returns the requested pane unchanged when
  `subPanes >= 1` and the request is non-overlay.
- `resolvePane` returns the manifest default when `requested ===
  undefined`.
- `resolvePane(\"new\", ...)` coalesces to `ctx.defaultPane` when
  that default is already a subpane, or to `ctx.scriptPane` when
  the script is overlay-default.
- `subPanes === 0` adapters still see overlay-folded emissions +
  the `unsupported-pane` diagnostic.
- `hline(price, { pane })` routes through the same resolver; no
  hard-coded `"overlay"` left in `hline.ts`.
- New property test passes with the pinned seed.
- Coverage stays at 100% on `runtime`.
- `pnpm docs:check` green (resolver + hline JSDoc updated).
- Changeset committed; semver bump `minor`.
