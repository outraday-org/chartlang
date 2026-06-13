# Task 12 — Runtime: `input.*` resolution + universal `opts.offset` audit

> **Status: TODO**

## Goal

Resolve user-supplied input overrides at script mount into the
typed `inputs` bag handed to `compute({ inputs })`. The
adapter-supplied override map merges over the manifest's defaults;
unknown keys fall back to the default; type-mismatched values
fall back to the default + emit `input-coercion-failed` (existing
`DiagnosticCode`, declared in adapter-kit pre-Phase-4).
Audit every `ta.*` primitive for universal `opts.offset` support
(PLAN §9.1). Verify `ta.nz(value, replacement)` is shipped and
exercise it in a regression test. No new primitives land — this
task is plumbing + audit.

## Prerequisites

- Task 11 (`buildComputeContext` is at the Task-11 baseline).

## Current Behavior

- `ComputeContext.inputs` is wired as
  `Readonly<Record<string, unknown>>`, populated from
  `manifest.inputs` defaults only (Phase-1 path).
- No adapter-override merge.
- `opts.offset` is supported on every Phase-2 `ta.*` primitive
  per Phase-2 Task X-29 — but no test asserts the audit at the
  package surface.
- `ta.nz` is in `STATEFUL_PRIMITIVES` per Phase 2 as `slot:
  false`.

## Desired Behavior

- `Adapter.resolveInputs(scriptId): Readonly<Record<string,
  unknown>>` (optional new method) returns user-supplied values;
  the runtime merges over defaults at script mount.
- `ComputeContext.inputs` carries typed scalars matching the
  descriptor — `input.int(20)` → `inputs.length === 20`,
  `input.bool(true)` → `inputs.flag === true`. The runtime walks
  each descriptor and reads `.defaultValue`, then overwrites with
  the adapter's value if present and type-compatible.
- Type mismatch emits `input-coercion-failed` once per
  (mount × key), falls back to default.
- A standalone `taOffsetAudit.test.ts` asserts every entry in
  `STATEFUL_PRIMITIVES` whose name starts with `ta.` exposes the
  `opts.offset` parameter (verified via TypeScript reflection on
  the opts types or by exhaustively calling each primitive with
  `{ offset: 0 }` and asserting it compiles).
- `ta.nz` smoke test passes — NaN replaces with replacement
  unconditionally; finite values pass through.

## Requirements

### 1. `packages/runtime/src/inputs/resolveInputs.ts`

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ScriptManifest } from "@invinite-org/chartlang-core";
import type { RuntimeContext } from "../runtimeContext";

/**
 * Resolve the script's effective `inputs` bag from the manifest
 * defaults + an optional adapter-supplied override map. Type-
 * incompatible overrides fall back to the default and emit
 * `input-coercion-failed`.
 *
 * @since 0.4
 * @example
 *     // const inputs = resolveInputs(manifest, overrides, ctx);
 *     // inputs.length === 14
 *     const fn: typeof resolveInputs = resolveInputs;
 *     void fn;
 */
export function resolveInputs(
    manifest: ScriptManifest,
    overrides: Readonly<Record<string, unknown>>,
    ctx: RuntimeContext,
): Readonly<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    for (const [key, descriptor] of Object.entries(manifest.inputs)) {
        const d = descriptor as { kind: string; defaultValue: unknown };
        const override = overrides[key];
        if (override === undefined) {
            out[key] = d.defaultValue;
            continue;
        }
        if (matchesKind(d.kind, override)) {
            out[key] = override;
        } else {
            ctx.emissions.diagnostics.push({
                kind: "diagnostic",
                code: "input-coercion-failed",
                message: `input "${key}" expected ${d.kind}, got ${typeof override}`,
                relatedCallsite: key,
                bar: ctx.barIndex(),
                time: ctx.stream.bar.time,
            });
            out[key] = d.defaultValue;
        }
    }
    return Object.freeze(out);
}

function matchesKind(kind: string, value: unknown): boolean {
    switch (kind) {
        case "int":
        case "float":
        case "time":
        case "price":
            return typeof value === "number" && Number.isFinite(value);
        case "bool":
            return typeof value === "boolean";
        case "string":
        case "color":
        case "source":
        case "symbol":
        case "interval":
        case "enum":
            return typeof value === "string";
        case "external-series":
            return value !== null && typeof value === "object";
        default:
            return false;
    }
}
```

### 2. `packages/runtime/src/createScriptRunner.ts` — wire resolution

At script mount:

```ts
const overrides = adapter.resolveInputs?.(scriptId) ?? {};
const inputs = resolveInputs(manifest, overrides, ctx);
ctx.resolvedInputs = inputs;
```

`ctx.resolvedInputs` is a new field on `RuntimeContext`; the
`buildComputeContext` returned `inputs` reads from it.

### 3. `packages/runtime/src/buildComputeContext.ts` — read resolved

```ts
return {
    bar,
    inputs: ctx.resolvedInputs,
    ta,
    plot, hline, alert, draw,
    state: buildStateNamespace(),
    barstate: ctx.views.barstate,
    syminfo: ctx.views.syminfo,
    timeframe: ctx.views.timeframe,
    request: buildRequestNamespace(),
};
```

### 4. `packages/adapter-kit/src/types.ts` — extend `Adapter`

Add the optional method:

```ts
export type Adapter = Readonly<{
    capabilities: Capabilities;
    candles: AdapterCandles;
    onEmissions: AdapterOnEmissions;
    dispose: AdapterDispose;
    /** @since 0.4 — optional script-input override resolver. */
    resolveInputs?: (scriptId: string) => Readonly<Record<string, unknown>>;
    /** @since 0.4 — optional mount-time sym-info payload. (Task 10 already added.) */
    symInfo?: AdapterSymInfo;
}>;
```

`"input-coercion-failed"` is already declared in
`DiagnosticCode`. Verify; no extension needed.

### 5. Universal `opts.offset` audit

Create `packages/runtime/src/ta/_audit/optsOffsetAudit.test.ts`.
The test enumerates `STATEFUL_PRIMITIVES_BY_NAME` for every
entry whose name starts with `ta.`. For each, it dynamically
exercises the primitive with `{ offset: 0 }` and asserts the
return is finite (post-warmup). Primitives whose opts shape
doesn't include `offset` fail the test and require a backfill
patch.

If any primitive fails the audit, fix in this task — backfill
`offset?: number` on the opts type + thread through the runtime.
PLAN §9.1 mandates universal support.

### 6. `ta.nz` regression test

Find the existing `ta.nz` impl in `packages/runtime/src/ta/nz.ts`
(or wherever it lives — was added in Phase 2). Add a regression
test (if missing):

```ts
expect(ta.nz(NaN, 42)).toBe(42);
expect(ta.nz(7, 42)).toBe(7);
expect(ta.nz(0, 42)).toBe(0);  // 0 is finite, not replaced
```

Verify `ta.nz` JSDoc carries the `@since` tag + an `@example`.

### 7. Tests

- **`resolveInputs.test.ts`** — table-driven: every `InputKind`
  ×
  (override matches | mismatches | absent) → expected resolved
  value + diagnostic. Cover the dedup behavior on repeat-mount.
- **`optsOffsetAudit.test.ts`** — programmatic enumeration over
  every `ta.*` primitive.
- **`taNz.test.ts`** (extend existing or create) — `ta.nz`
  regression.

### 8. JSDoc gate

Every new export carries `@since 0.4` + compileable `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/inputs/resolveInputs.ts` | Create | Resolution + diagnostic |
| `packages/runtime/src/inputs/index.ts` | Create | Barrel |
| `packages/runtime/src/inputs/resolveInputs.test.ts` | Create | Per-kind coverage |
| `packages/runtime/src/runtimeContext.ts` | Modify | Add `resolvedInputs` field |
| `packages/runtime/src/buildComputeContext.ts` | Modify | Read `resolvedInputs` |
| `packages/runtime/src/createScriptRunner.ts` | Modify | Wire mount-time resolution |
| `packages/runtime/src/createScriptRunner.test.ts` | Modify | Cover resolution path |
| `packages/runtime/src/ta/_audit/optsOffsetAudit.test.ts` | Create | Universal-offset enumeration |
| `packages/runtime/src/ta/nz.test.ts` | Verify or create | `ta.nz` regression |
| `packages/adapter-kit/src/types.ts` | Modify | Add `Adapter.resolveInputs?` (no `DiagnosticCode` change — `input-coercion-failed` is pre-declared) |
| `packages/adapter-kit/src/types.types.test.ts` | Modify | Cover `resolveInputs?` |
| `examples/canvas2d-adapter/src/adapter.ts` | Modify | Optional `resolveInputs` demo |

## Edge Cases

- **`undefined` override** — falls back to the descriptor's
  `defaultValue`, no diagnostic.
- **`NaN` override on a numeric input** — fails the
  `Number.isFinite` gate → diagnostic + default fallback.
- **`enum` override mismatch** — string value not in
  `options` array. Currently the resolver accepts any string;
  add explicit enum-membership check that emits the existing
  `input-coercion-failed` code (no new code introduced —
  `DiagnosticCode` already covers this category).
- **`source` override** — must be one of the `SourceField` literal
  values; otherwise emit `input-coercion-failed`.
- **Override dedup** — diagnostic fires once per (mount, key);
  the runtime tracks `diagnosedInputKeys: Set<string>` on
  `RuntimeContext`.
- **`Object.freeze` on `inputs`** — caller-provided overrides
  are not mutated; the resolved bag is a fresh frozen record.
- **`opts.offset` audit failure** — if a primitive in the
  enumerated set is missing `offset` support, this task is the
  place to fix it. Document the gap in the changeset.
- **`ta.nz` semantic** — `0` is finite, NOT replaced. Pine
  `nz()` parity. The test pins the behaviour.

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (100% coverage,
  including the audit's coverage contribution),
  `pnpm docs:check`, `pnpm readme:check`, `pnpm conformance`,
  `pnpm bench:ci`.

## Changeset

`.changeset/phase-4-task-12-runtime-inputs-and-offset.md` —
**minor** on `@invinite-org/chartlang-runtime` + `@invinite-org/
chartlang-adapter-kit` (optional `Adapter.resolveInputs`).

## Acceptance Criteria

- `compute({ inputs })` receives the manifest defaults overridden
  by the adapter's payload.
- Type-mismatched overrides fall back to defaults + emit the
  diagnostic.
- `optsOffsetAudit.test.ts` passes — every `ta.*` primitive
  accepts `opts.offset`.
- `ta.nz` regression test passes.
- 100% coverage on touched files.
- Phase-1/2/3 example scripts still run end-to-end.
- Changeset committed.
