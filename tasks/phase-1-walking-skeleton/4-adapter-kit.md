# Task 4 — Adapter-kit: Adapter Shape, Capabilities, Emission Validators

> **Status: TODO**

## Goal

Land `@invinite-org/chartlang-adapter-kit`: the `Adapter` /
`CandleEvent` / `Capabilities` types per §7.1-§7.3, capability
builders that simplify wiring an adapter's declared surface,
`validateEmission` for the Phase-1 emission shapes, a stub
`decodeDrawing` (full impl in Phase 3), mock candle sources used by
runtime + conformance tests, and the `PassThroughAdapter` /
`BufferingAdapter` base classes.

## Prerequisites

- Task 1 complete: `@invinite-org/chartlang-core` types
  (`Bar`, `Series`, `AlertSeverity`, etc.) are available.

## Desired Behavior

After this task:

- Any consumer can `import { defineAdapter, Capabilities, capabilities,
  validateEmission, mockCandleSource, PassThroughAdapter,
  BufferingAdapter } from "@invinite-org/chartlang-adapter-kit"`.
- The Capabilities shape declares everything the runtime (Task 5),
  host-worker (Task 8), and canvas2d adapter (Task 9) need to gate
  emissions.
- `validateEmission(e)` returns `{ ok: true } | { ok: false; code:
  DiagnosticCode; message: string }` per §7.3, hand-rolled (no
  `zod` / `valibot`).
- `capabilities.line()` / `capabilities.horizontalLine()` /
  `capabilities.alert("toast")` produce the right `ReadonlySet`
  pieces of a `Capabilities` bag.
- `mockCandleSource(bars: Bar[])` returns an
  `AsyncIterable<CandleEvent>` the runtime + conformance tests
  consume directly.
- 100% coverage on every validator branch.

## Requirements

### 1. `src/types.ts` — §7.1-§7.2 types

Exhaustively type the Phase-1 surface. Types-only file (excluded
from coverage).

```ts
import type {
    Bar, IntervalDescriptor, AlertSeverity, JsonValue,
} from "@invinite-org/chartlang-core";

// Phase 1 omits PLAN §7.1's optional `feedExternalSeries?`. That
// surface arrives with `input.external-series` in Phase 4; the
// chartlang-side Adapter shape is additive, so consumer-repo
// adapters won't need a breaking change to opt in later.
export type Adapter = {
    readonly id: string;
    readonly name: string;
    readonly capabilities: Capabilities;
    candles(opts: { interval: string | "chart" }): AsyncIterable<CandleEvent>;
    onEmissions(emissions: RunnerEmissions): void;
    dispose(): void;
};

export type CandleEvent =
    | { kind: "history"; bars: ReadonlyArray<Bar> }
    | { kind: "close"; bar: Bar }
    | { kind: "tick"; bar: Bar };

export type PlotKind =
    | "line" | "step-line" | "horizontal-line"
    // Phase 1 ships these three. Phase 2+ extends — additive only.
    ;

export type DrawingKind = "line";  // placeholder — full enum lands in Phase 3.

export type AlertChannel =
    | "log" | "toast" | "webhook" | "email" | "sms" | "push";

export type InputKind =
    | "int" | "float" | "bool" | "string" | "enum"
    | "color" | "source" | "time" | "price" | "symbol"
    | "interval" | "external-series";

export type SymInfoField =
    | "ticker" | "type" | "mintick" | "currency" | "basecurrency"
    | "exchange" | "timezone" | "session" | "meta";

export type Capabilities = {
    readonly plots: ReadonlySet<PlotKind>;
    readonly drawings: ReadonlySet<DrawingKind>;
    readonly alerts: ReadonlySet<AlertChannel>;
    readonly alertConditions: boolean;
    readonly logs: boolean;
    readonly inputs: ReadonlySet<InputKind>;
    readonly intervals: ReadonlyArray<IntervalDescriptor>;
    readonly multiTimeframe: boolean;
    readonly subPanes: number;
    readonly symInfoFields: ReadonlySet<SymInfoField>;
    readonly maxDrawingsPerScript: {
        readonly lines: number; readonly labels: number;
        readonly boxes: number; readonly polylines: number;
        readonly other: number;
    };
    readonly maxLookback: number;
    readonly maxTickHz: number;
};

// Emission types — single source of truth for Phase 1. Imported
// from here by runtime (Task 5+7), host-worker (Task 8), canvas2d
// adapter (Task 9), conformance (Task 11).
export type PlotEmission = {
    readonly kind: "plot";
    readonly slotId: string;
    readonly title: string;
    readonly style: PlotStyle;
    readonly bar: number;
    readonly time: number;
    readonly value: number | null;
    readonly color: string | null;
    readonly meta: Readonly<Record<string, JsonValue>>;
    readonly pane: "overlay" | "new" | string;
};

export type PlotStyle =
    | { kind: "line"; lineWidth: number; lineStyle: "solid" | "dashed" | "dotted" }
    | { kind: "step-line"; lineWidth: number; lineStyle: "solid" | "dashed" | "dotted" }
    | { kind: "horizontal-line"; lineWidth: number; lineStyle: "solid" | "dashed" | "dotted" };

export type AlertEmission = {
    readonly kind: "alert";
    readonly slotId: string;
    readonly severity: AlertSeverity;
    readonly message: string;
    readonly bar: number;
    readonly time: number;
    readonly meta: Readonly<Record<string, JsonValue>>;
    readonly channels: ReadonlyArray<AlertChannel>;
    readonly dedupeKey: string;
};

export type DrawingEmission = {
    readonly kind: "drawing";
    readonly handleId: string;
    readonly drawingKind: DrawingKind;
    readonly op: "create" | "update" | "remove";
    readonly state: unknown;
    readonly bar: number;
    readonly time: number;
};

export type RuntimeDiagnostic = {
    readonly kind: "diagnostic";
    readonly severity: "info" | "warning" | "error";
    readonly code: DiagnosticCode;
    readonly message: string;
    readonly slotId: string | null;
    readonly bar: number | null;
};

export type DiagnosticCode =
    | "unsupported-plot-kind"
    | "unsupported-drawing-kind"
    | "unsupported-alert-channel"
    | "unsupported-pane"
    | "unsupported-interval"
    | "multi-timeframe-not-supported"
    | "lookback-exceeded"
    | "drawing-budget-exceeded"
    | "dropped-by-policy"
    | "input-coercion-failed"
    | "alert-rate-limited"
    | "runtime-cpu-budget-exceeded"
    | "runtime-memory-budget-exceeded"
    | "malformed-emission";

export type RunnerEmissions = {
    readonly plots: ReadonlyArray<PlotEmission>;
    readonly drawings: ReadonlyArray<DrawingEmission>;
    readonly alerts: ReadonlyArray<AlertEmission>;
    readonly diagnostics: ReadonlyArray<RuntimeDiagnostic>;
    readonly fromBar: number;
    readonly toBar: number;
};
```

The full §7.3 emission surface (alertConditions, logs, more
PlotKinds, drawings) lands additively in later phases. Phase 1
ships the minimum the three example scripts exercise.

### 2. `src/defineAdapter.ts`

```ts
export type DefineAdapterOpts = Omit<Adapter, "dispose"> & {
    dispose?: () => void;
};

export function defineAdapter(opts: DefineAdapterOpts): Adapter {
    return {
        id: opts.id,
        name: opts.name,
        capabilities: opts.capabilities,
        candles: opts.candles,
        onEmissions: opts.onEmissions,
        dispose: opts.dispose ?? (() => { /* no-op */ }),
    };
}
```

The wrapper exists so consumer-repo adapters get a stable entry
point + default `dispose` no-op.

### 3. `src/capabilities/capabilities.ts` — builders

```ts
export const capabilities = {
    line(): ReadonlySet<PlotKind> {
        return new Set<PlotKind>(["line"]);
    },
    stepLine(): ReadonlySet<PlotKind> {
        return new Set<PlotKind>(["step-line"]);
    },
    horizontalLine(): ReadonlySet<PlotKind> {
        return new Set<PlotKind>(["horizontal-line"]);
    },
    allLines(): ReadonlySet<PlotKind> {
        return new Set<PlotKind>(["line", "step-line", "horizontal-line"]);
    },
    alerts(...channels: AlertChannel[]): ReadonlySet<AlertChannel> {
        return new Set<AlertChannel>(channels);
    },
    union<T>(...sets: ReadonlySet<T>[]): ReadonlySet<T> {
        const out = new Set<T>();
        for (const s of sets) { for (const v of s) { out.add(v); } }
        return out;
    },
};
```

Phase 2+ extends with `histogram`, `area`, `filledBand`, etc. —
additive only. Tests cover every builder.

### 4. `src/validation/validateEmission.ts` — hand-rolled validator

§7.3 universal payload rules:
- All emission fields are JSON-friendly.
- `NaN` / `Infinity` / `-Infinity` are forbidden in numeric fields —
  numeric "skip" is `null` (the wire-level NaN). `value` is
  `number | null`.
- `Map`, `Set`, `Date`, `Function`, `Symbol`, `bigint`, class
  instances, `undefined` values are forbidden.

```ts
export type ValidationOk = { readonly ok: true };
export type ValidationFail = {
    readonly ok: false;
    readonly code: DiagnosticCode;       // "malformed-emission" for shape errors
    readonly message: string;
};
export type ValidationResult = ValidationOk | ValidationFail;

export function validateEmission(
    e: unknown,
): ValidationResult;
```

Branches:

- Top-level dispatch on the `kind` discriminant via type-narrowing
  on `unknown` (biome rejects `as any`):

  ```ts
  if (typeof e !== "object" || e === null || !("kind" in e)) {
      return { ok: false, code: "malformed-emission", message: "not an object with a kind field" };
  }
  switch ((e as { kind: unknown }).kind) {
      case "plot":       return validatePlotEmission(e);
      case "alert":      return validateAlertEmission(e);
      case "drawing":    return validateDrawingEmission(e);
      case "diagnostic": return validateDiagnostic(e);
      default:           return { ok: false, code: "malformed-emission", message: "unknown kind" };
  }
  ```

  Phase 1 `validateDrawingEmission` returns
  `{ ok: false, code: "unsupported-drawing-kind", message: "..." }`
  unconditionally — no `draw.*` exists yet.

Per-shape validators check:

`validatePlotEmission`:
- `slotId: string` non-empty.
- `title: string`.
- `style.kind` ∈ `{ "line" | "step-line" | "horizontal-line" }`.
- `style.lineWidth` is finite positive number.
- `style.lineStyle` ∈ `{ "solid", "dashed", "dotted" }`.
- `bar: number` integer ≥ 0.
- `time: number` finite.
- `value: number | null` — if number, finite (no NaN / Inf).
- `color: string | null`.
- `meta: object`, no `undefined` values.
- `pane: string`.

`validateAlertEmission`:
- `slotId: string` non-empty.
- `severity ∈ { "info", "warning", "critical" }`.
- `message: string` non-empty.
- `bar: number` integer ≥ 0.
- `time: number` finite.
- `meta: object`.
- `channels: readonly array of AlertChannel`.
- `dedupeKey: string` non-empty.

`validateDiagnostic`:
- `severity ∈ { "info", "warning", "error" }`.
- `code ∈ DiagnosticCode` set (use a frozen `Set<string>` for
  membership check).

Walk `meta` recursively to assert JSON-cleanliness — refuse `Map`,
`Set`, `Date`, `BigInt`, `Function`, `Symbol`, `undefined`. Reject
non-finite numbers anywhere in `meta`.

Each rejection path has its own message string so debugging is
direct.

### 5. `src/validation/decodeDrawing.ts` — Phase-1 stub

```ts
export function decodeDrawing(e: DrawingEmission): null {
    // Phase 1 ships no draw.* primitives; the decoder is a stub
    // that always returns null. Phase 3 returns the decoded
    // DrawingState union.
    return null;
}
```

Single unit test covering the one branch.

### 6. `src/mocks/mockCandleSource.ts`

```ts
export function mockCandleSource(
    bars: ReadonlyArray<Bar>,
    opts: { interval: string; mode?: "history" | "stream" } = { interval: "1D" },
): AsyncIterable<CandleEvent> {
    const mode = opts.mode ?? "history";
    return {
        async *[Symbol.asyncIterator]() {
            if (mode === "history") {
                yield { kind: "history", bars };
                return;
            }
            for (const bar of bars) {
                yield { kind: "close", bar };
            }
        },
    };
}
```

The runtime + conformance tests use this to drive bars into the
ScriptRunner without a real candle source.

### 7. `src/base/passThroughAdapter.ts`

```ts
export class PassThroughAdapter implements Adapter {
    constructor(
        readonly id: string,
        readonly name: string,
        readonly capabilities: Capabilities,
        private readonly source: AsyncIterable<CandleEvent>,
    ) {}

    candles(): AsyncIterable<CandleEvent> { return this.source; }
    onEmissions(_e: RunnerEmissions): void { /* no-op */ }
    dispose(): void { /* no-op */ }
}
```

`BufferingAdapter` keeps a `RunnerEmissions[]` array internally
and exposes a `drain(): RunnerEmissions[]` method. Used by
conformance tests (Task 11) to collect emissions across an entire
fixture playback.

```ts
export class BufferingAdapter implements Adapter {
    private buffered: RunnerEmissions[] = [];
    constructor(
        readonly id: string,
        readonly name: string,
        readonly capabilities: Capabilities,
        private readonly source: AsyncIterable<CandleEvent>,
    ) {}

    candles(): AsyncIterable<CandleEvent> { return this.source; }
    onEmissions(e: RunnerEmissions): void { this.buffered.push(e); }
    drain(): RunnerEmissions[] { const out = this.buffered; this.buffered = []; return out; }
    dispose(): void { this.buffered = []; }
}
```

### 8. Tests

§16.3 row: unit + conformance + type.

- **Unit tests:**
  - `defineAdapter` returns the right shape; default `dispose`
    is no-op.
  - Every capability builder produces the expected frozen Set.
  - `validateEmission`: positive + negative test for every
    branch. Aim for 100% branches across both validators.
  - `decodeDrawing` always returns `null`.
  - `mockCandleSource`: `history` mode emits one `{ kind:
    "history", bars }` event; `stream` mode emits one `{ kind:
    "close" }` per bar; empty array works in both modes.
  - `PassThroughAdapter` + `BufferingAdapter` shape + buffering
    semantics.
- **Type tests (`types.types.test.ts`):** `expect-type` over
  every exported type — `Capabilities`, `Adapter`, every
  emission shape.

Conformance integration is exercised in Task 11 — no scenarios
ship from this package directly.

### 9. README + JSDoc

- `README.md` ≤ 100 lines, §17.1 structure. Public-surface section
  enumerates: `defineAdapter`, `capabilities`,
  `validateEmission`, `decodeDrawing`, `mockCandleSource`,
  `PassThroughAdapter`, `BufferingAdapter`, plus the exported
  types.
- Every export has `@since 0.1` + `@example`. The
  `defineAdapter` example imports from
  `@invinite-org/chartlang-adapter-kit` and stays self-contained
  (no chartlang script source) so `docs-check` skips it.

### 10. Remove `PACKAGE_VERSION`

Delete the placeholder export + its JSDoc shim added in Task 3.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/adapter-kit/src/types.ts` | Create | Adapter / Capabilities / emission types. |
| `packages/adapter-kit/src/defineAdapter.ts` | Create | Adapter factory. |
| `packages/adapter-kit/src/capabilities/capabilities.ts` | Create | Capability builders. |
| `packages/adapter-kit/src/capabilities/index.ts` | Create | Barrel. |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Create | Hand-rolled validator. |
| `packages/adapter-kit/src/validation/decodeDrawing.ts` | Create | Phase-1 stub. |
| `packages/adapter-kit/src/validation/index.ts` | Create | Barrel. |
| `packages/adapter-kit/src/mocks/mockCandleSource.ts` | Create | AsyncIterable mock source. |
| `packages/adapter-kit/src/mocks/index.ts` | Create | Barrel. |
| `packages/adapter-kit/src/base/passThroughAdapter.ts` | Create | Base class. |
| `packages/adapter-kit/src/base/bufferingAdapter.ts` | Create | Base class. |
| `packages/adapter-kit/src/base/index.ts` | Create | Barrel. |
| `packages/adapter-kit/src/index.ts` | Modify | Replace placeholder with the full barrel. |
| `packages/adapter-kit/src/index.test.ts` | Delete | Replaced by per-module tests. |
| `packages/adapter-kit/src/*/*.test.ts` | Create | Per-module unit tests. |
| `packages/adapter-kit/src/types.types.test.ts` | Create | `expect-type` assertions. |
| `packages/adapter-kit/package.json` | Modify | Add `@invinite-org/chartlang-core` workspace dep. |
| `packages/adapter-kit/README.md` | Modify | Replace planned-surface with real example. |

## Acceptance Criteria

- `pnpm -F @invinite-org/chartlang-adapter-kit typecheck && pnpm
  -F @invinite-org/chartlang-adapter-kit test` pass with 100%
  coverage.
- A consumer can write:
  ```ts
  import { defineAdapter, capabilities, mockCandleSource }
      from "@invinite-org/chartlang-adapter-kit";

  const adapter = defineAdapter({
      id: "test", name: "Test",
      capabilities: { plots: capabilities.allLines(), /* ... */ },
      candles: () => mockCandleSource([], { interval: "1D" }),
      onEmissions: () => {},
  });
  ```
  and type-check.
- `validateEmission` rejects every malformed shape from §7.3 with
  `malformed-emission` and accepts every valid Phase-1 emission
  shape.
- `pnpm docs:check`, `readme:check`, `lint`, `format:check`,
  `conformance` (still 0 scenarios), and Phase-0 + Tasks 1-3 gates
  all pass.
