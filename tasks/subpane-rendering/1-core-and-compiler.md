# Task 1 — Core types + compiler manifest propagation

> **Status: TODO**

## Goal

Persist `defineIndicator({ overlay })` onto `ScriptManifest.overlay`
so the runtime can use it as the script-level default pane signal.
Add `pane?: "overlay" | "new" | string` to `HLineOpts` so hlines
participate in the same pane router the next task wires up. Update
the compiler's ambient shim + manifest builder so the field round-
trips through `compile()` → `__manifest` → re-import.

## Prerequisites

None.

## Current Behavior

- `DefineIndicatorOpts.overlay?: boolean` (`packages/core/src/define/defineIndicator.ts:28`)
  is accepted by the constructor but **never spread onto the manifest**
  (`defineIndicator.ts:80-92`). Authors who write `overlay: false` see
  the flag silently dropped — `defineIndicator({ overlay: false })()`
  produces a manifest identical to the no-`overlay` form.
- `ScriptManifest` (`packages/core/src/types.ts:315-490`) has no
  `overlay` field. Existing optional fields include `maxDrawings`,
  `maxBarsBack`, `format`, `precision`, `scale`, `shortName`,
  `requiresIntervals`, `alertConditions`, `dependencies`, `outputs`,
  `plots`, `exportName`, `siblings`, `isDrawn`.
- `HLineOpts` (`packages/core/src/plot/plot.ts:249-254`) has no `pane`
  field; the current JSDoc (lines 242-243) actively documents "Unlike
  `plot`, `hline` is always a single horizontal line at a fixed price;
  no pane override" — that paragraph must be lifted. The runtime hline
  emit (`packages/runtime/src/emit/hline.ts:42`) is hard-pinned to
  `pane: "overlay"`.
- The compiler's ambient core shim
  (`packages/compiler/src/program.ts:1050-1074`) declares
  `ScriptManifest` without the `overlay` field; `DefineIndicatorOpts`
  at lines 1313-1321 already lists `overlay?: boolean` (so the
  authoring side passes type checks), but the field has no destination.
- `packages/compiler/src/manifest.ts` (`buildManifest` at lines 34-140)
  builds the JSON manifest from a typed args bag passed by the caller;
  it does not currently accept or emit `overlay`. Existing conditional
  spreads include `maxBarsBack`, `format`, `precision`, `scale`,
  `requiresIntervals`, `shortName`, `alertConditions`, `dependencies`,
  `outputs`, `plots`, `exportName`, `isDrawn`, `siblings` (lines 126-138).
  The AST extraction that populates the args bag lives at the
  `buildManifest` call site (search compiler for `buildManifest(`).

## Desired Behavior

- `ScriptManifest.overlay?: boolean` is a documented optional field
  (Phase 2+ surface). Absent / `true` mean "overlay" (matches
  existing default); explicit `false` means "subpane routing
  requested" — the runtime in Task 2 reads it as the script-level
  default pane.
- `HLineOpts.pane?: "overlay" | "new" | string` lets hlines opt into
  a non-overlay pane in the same shape as `PlotOpts.pane`. JSDoc
  notes that omitting `pane` defaults to the script's
  manifest-resolved default (which is `"overlay"` unless `overlay:
  false` was set), so existing scripts are unaffected.
- `defineIndicator({ overlay })` spreads the flag onto the frozen
  manifest object.
- The compiler's `buildManifest` reads `overlay` from the
  `defineIndicator(...)` opts AST node and emits the field on the
  `__manifest` JSON.
- The ambient shim's `ScriptManifest` type carries the `overlay?:
  boolean` field so downstream packages (runtime, host-worker)
  type-check against the same shape.

## Requirements

### 1. `packages/core/src/types.ts` — add the field to `ScriptManifest`

Append a new optional field with JSDoc:

```ts
/**
 * `overlay: false` on `defineIndicator(...)` is persisted here as the
 * script-level default pane signal. Absent / `true` means the script
 * defaults to the price overlay pane; `false` means the runtime
 * routes every `plot()` / `hline()` call without an explicit `pane`
 * opt into a per-script subpane key.
 *
 * @since 0.2
 * @stable
 * @example
 *     const m: Pick<ScriptManifest, "overlay"> = { overlay: false };
 *     void m;
 */
readonly overlay?: boolean;
```

Place alphabetically after `maxLookback` and before `maxDrawings` to
keep the JSDoc-driven docs page ordering stable.

### 2. `packages/core/src/define/defineIndicator.ts` — store `overlay`

Spread `overlay` into the manifest builder block (currently lines 80-92):

```ts
const manifest = {
    ...base,
    ...(opts.overlay === undefined ? {} : { overlay: opts.overlay }),
    ...(opts.maxDrawings === undefined ? {} : { maxDrawings: opts.maxDrawings }),
    // ... existing spreads (maxBarsBack, format, precision, scale,
    //     requiresIntervals, shortName, outputs) stay.
};
```

Conditional spread — absent stays absent, present (including `true`)
is preserved. Matches the existing `maxDrawings` / `maxBarsBack` /
etc. pattern. Place the spread alphabetically (after `maxDrawings`) so
the runtime sees a stable field order.

### 3. `packages/core/src/define/defineIndicator.test.ts` — round-trip test

Add two cases:

- `defineIndicator({ name: "x", apiVersion: 1, overlay: false,
  compute() {} }).manifest.overlay === false`
- `defineIndicator({ name: "x", apiVersion: 1, compute() {} })
  .manifest.overlay === undefined` (absence preserved).

### 4. `packages/core/src/plot/plot.ts` — extend `HLineOpts`

Replace the current JSDoc (which actively states "no pane override")
and append `pane?: "overlay" | "new" | string`:

```ts
/**
 * Styling options accepted by `hline(...)`. `pane` follows the same
 * shape as {@link PlotOpts.pane}: omit to fall back to the script's
 * manifest-resolved default (overlay unless `defineIndicator({
 * overlay: false })` was declared); `"overlay"` pins the line to the
 * price pane; `"new"` opens / joins the per-script subpane; named
 * panes route to a shared subpane key.
 *
 * @since 0.1
 * @example
 *     const opts: HLineOpts = {
 *         color: "#ef4444",
 *         title: "RSI 70",
 *         lineStyle: "dashed",
 *         pane: "new",
 *     };
 */
export type HLineOpts = Readonly<{
    color?: Color;
    title?: string;
    lineWidth?: number;
    lineStyle?: LineStyle;
    pane?: "overlay" | "new" | string;
}>;
```

The "Unlike `plot`, `hline` is always a single horizontal line at a
fixed price; no pane override" sentence must be deleted — the
contract is now exactly the opposite.

### 5. `packages/core/src/plot/plot.test.ts` — type-level coverage

The repo has **no `plot.types.test.ts`** — type assertions live in
`packages/core/src/plot/plot.test.ts`. Append a new `describe` block:

```ts
describe("HLineOpts.pane", () => {
    it("accepts the three-variant pane shape", () => {
        const overlay: HLineOpts = { pane: "overlay" };
        const fresh: HLineOpts = { pane: "new" };
        const named: HLineOpts = { pane: "rsi" };
        void overlay;
        void fresh;
        void named;
    });
});
```

Mirror the existing `void`-pattern used by the `PlotKind` /
`PlotOptsStyle` blocks at the bottom of the file.

### 6. `packages/compiler/src/manifest.ts` + `analysis/structuralChecks.ts` — extract & emit `overlay`

Two coupled edits, mirroring the existing `maxBarsBack` / `format`
flow:

(a) `packages/compiler/src/analysis/structuralChecks.ts` —
`StructuralScriptOverrides` (lines 29-36) and `extractOverrides`
(lines 146-185):

```ts
export type StructuralScriptOverrides = Readonly<{
    overlay?: boolean;        // NEW
    maxBarsBack?: number;
    format?: ValueFormat;
    precision?: number;
    scale?: ScaleAxis;
    requiresIntervals?: ReadonlyArray<string>;
    shortName?: string;
}>;
```

Inside the `for (const property of argument.properties)` loop, add a
literal-boolean reader for the `overlay` property (only for `kind ===
"indicator"` — `defineDrawing` / `defineAlert` don't accept it):

```ts
} else if (propertyName.text === "overlay" && kind === "indicator") {
    if (initializer.kind === ts.SyntaxKind.TrueKeyword) overlay = true;
    else if (initializer.kind === ts.SyntaxKind.FalseKeyword) overlay = false;
}
```

…and spread it into the frozen return:

```ts
return Object.freeze({
    ...(overlay === undefined ? {} : { overlay }),
    ...(maxBarsBack === undefined ? {} : { maxBarsBack }),
    // ... existing spreads stay
});
```

(b) `packages/compiler/src/manifest.ts` (`buildManifest` lines 34-140):

- Add `readonly overlay?: boolean;` to the `args` type, placed
  alphabetically after `inputs` (matches the `ScriptManifest` order
  from Step 1).
- Add `...(args.overlay === undefined ? {} : { overlay: args.overlay }),`
  to the conditional-spread block at lines 126-138, alphabetically
  positioned (after `maxBarsBack` if `maxDrawings` isn't yet emitted
  by this builder).

The `api.ts` call sites at lines 195, 301, 384 forward
`...structural.overrides` via spread, so adding `overlay` to
`StructuralScriptOverrides` is enough — those call sites need no
further change.

### 7. `packages/compiler/src/manifest.test.ts` — bundle round-trip

Add a test that compiles a minimal `defineIndicator({ overlay: false,
... })` source via `compile()`, dynamically `import()`s the bundle,
and asserts `__manifest.overlay === false`. Add a sibling test
asserting `overlay: true` round-trips. Add a third test asserting
that omitting the property leaves `__manifest.overlay` absent.

### 8. `packages/compiler/src/program.ts` ambient shim

Update the `ScriptManifest` declaration block (currently lines 1050-1074)
to include `readonly overlay?: boolean;` placed alphabetically. The
`DefineIndicatorOpts` block at lines 1313-1321 already lists `overlay`;
no edit needed there. The shim is the compiler's authoritative view of
core's types — keep it in lockstep with `packages/core/src/types.ts`
per the `packages/compiler/CLAUDE.md` invariant ("Core resolves through
an ambient shim").

### 9. `packages/core/README.md`

The file is currently 59 lines (well under the 100-line cap). The
public-surface section (lines 14-32) lists exports without a field
count, so no field-count update is required. If a `ScriptManifest`
example block exists that omits `overlay`, leave it as the
no-`overlay` happy path; do not add net-new sections.

### Edge cases

- **`overlay: true` is preserved** — the field is round-tripped
  faithfully even though `true` is the existing implicit default;
  Task 2's runtime resolves the pane key from absence vs explicit
  `false`, not from `true`.
- **JSDoc gate** — every new field and new option carries `@since`,
  stability marker (`@stable`), and `@example`. The
  `packages/core/src/types.types.test.ts` is updated to typecheck the
  new field.
- **Coverage gate** — the conditional-spread branch in
  `defineIndicator.ts` adds one new branch; the new round-trip test
  covers both arms.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/types.ts` | Modify | Add `overlay?: boolean` to `ScriptManifest` (after line 489) |
| `packages/core/src/types.types.test.ts` | Modify | Cover the new field |
| `packages/core/src/define/defineIndicator.ts` | Modify | Spread `overlay` onto the manifest (lines 80-92) |
| `packages/core/src/define/defineIndicator.test.ts` | Modify | Round-trip + absence tests |
| `packages/core/src/plot/plot.ts` | Modify | Add `pane?` to `HLineOpts`, rewrite JSDoc to drop the "no pane override" wording |
| `packages/core/src/plot/plot.test.ts` | Modify | Type assertion `describe` block for `HLineOpts.pane` |
| `packages/compiler/src/manifest.ts` | Modify | Add `overlay?: boolean` to `buildManifest` args + conditional spread |
| `packages/compiler/src/analysis/structuralChecks.ts` | Modify | Add `overlay?: boolean` to `StructuralScriptOverrides` + read in `extractOverrides` |
| `packages/compiler/src/manifest.test.ts` | Modify | Round-trip for `overlay`: direct `buildManifest` test + `compile()` bundle test |
| `packages/compiler/src/program.ts` | Modify | Ambient shim — add `overlay?` to `ScriptManifest` (lines 1050-1074) |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm -F @invinite-org/chartlang-core test` (coverage 100%)
- `pnpm -F @invinite-org/chartlang-compiler test` (coverage 100%)
- `pnpm docs:check`
- `pnpm readme:check`

## Changeset

`.changeset/subpane-1-core-compiler.md` — `@invinite-org/chartlang-core`
and `@invinite-org/chartlang-compiler` get a `minor` bump; the
`ScriptManifest` shape change is additive (existing consumers keep
working without the new field).

## Acceptance Criteria

- `defineIndicator({ overlay: false }).manifest.overlay === false`
  asserted by unit test.
- `defineIndicator({ overlay: true }).manifest.overlay === true`
  asserted.
- Omitting `overlay` produces `manifest.overlay === undefined` —
  no implicit `true` injection.
- `compile()` of a script with `overlay: false` produces a bundle
  whose `__manifest.overlay === false` after dynamic import.
- The ambient shim's `ScriptManifest` carries `overlay?: boolean`;
  `packages/runtime/` continues to type-check against the shim
  unchanged.
- `HLineOpts.pane` accepts `"overlay" | "new" | "<id>"` per the
  type assertion test.
- Coverage stays at 100% on `core` and `compiler`.
- `pnpm docs:check` + `pnpm readme:check` green.
- Changeset committed; semver bump is `minor`.
