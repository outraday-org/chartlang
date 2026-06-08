# Task 1 — Core: `input.*` builders + `InputDescriptor` types

> **Status: TODO**

## Goal

Land the typed `input.*` builder surface in
`@invinite-org/chartlang-core` per PLAN.md §12: twelve builders
(`int`, `float`, `bool`, `string`, `enum`, `color`, `source`,
`time`, `price`, `symbol`, `interval`, `externalSeries`), the
shared `InputDescriptor<T>` shape, the `SourceField` literal
union, and a `Schema<T>` type for `externalSeries`. Widen the
existing `InputSchema` from `Readonly<Record<string, unknown>>` to
`Readonly<Record<string, InputDescriptor<unknown>>>` so downstream
manifest plumbing carries typed descriptors. Update `core/index.ts`
re-exports.

## Prerequisites

None. Phase 4 foundation — Task 2 onwards depends on this.

## Current Behavior

- `packages/core/src/types.ts` exports
  `InputSchema = Readonly<Record<string, unknown>>` as an opaque
  Phase-1 placeholder (around line 161).
- No `input` namespace exists in core.
- `packages/compiler/src/program.ts` ambient shim has no
  `input.*` declarations.
- `packages/core/src/index.ts` does not export `input` or
  `InputDescriptor`.

## Desired Behavior

- `import { input } from "@invinite-org/chartlang-core"` exposes
  the 12 builders with full JSDoc.
- Every builder returns `InputDescriptor<T>` carrying the wire
  `kind` discriminator + the default + the user-facing title +
  builder-specific opts.
- `InputSchema` widens to
  `Readonly<Record<string, InputDescriptor<unknown>>>`. Downstream
  consumers (`ScriptManifest.inputs`, `ComputeContext.inputs`)
  retain shape compatibility — they walk values structurally.
- `SourceField = "open" | "high" | "low" | "close" | "hl2" | "hlc3" | "ohlc4" | "hlcc4"`.
- `Schema<T>` is a minimal opaque wrapper for the `externalSeries`
  builder — Phase 4 ships the type; runtime validation lands in
  Phase 5.
- `core/index.ts` re-exports `input`, `InputDescriptor`,
  `InputKind`, `SourceField`, `Schema`.

## Requirements

### 1. `packages/core/src/input/inputDescriptor.ts`

Pin the `InputDescriptor<T>` discriminated union and the
`InputKind` literal alias matching adapter-kit's existing
`InputKind` set.

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Color } from "../types";

/**
 * Wire-tagged discriminator for every `input.*` descriptor. Mirrors
 * the {@link @invinite-org/chartlang-adapter-kit/InputKind} alias —
 * the two live in lockstep, declared here as the source of truth.
 *
 * @since 0.4
 * @example
 *     const k: InputKind = "int";
 *     void k;
 */
export type InputKind =
    | "int"
    | "float"
    | "bool"
    | "string"
    | "enum"
    | "color"
    | "source"
    | "time"
    | "price"
    | "symbol"
    | "interval"
    | "external-series";

/**
 * Source-field literal — names every pre-computed source the
 * runtime's `BarView` populates per close. Matches PLAN §12 and
 * {@link Bar}'s pre-computed fields (`hl2`, `hlc3`, `ohlc4`,
 * `hlcc4`) introduced in Phase 2.
 *
 * @since 0.4
 * @example
 *     const f: SourceField = "hlc3";
 *     void f;
 */
export type SourceField =
    | "open" | "high" | "low" | "close"
    | "hl2" | "hlc3" | "ohlc4" | "hlcc4";

/**
 * Opaque schema wrapper for {@link input.externalSeries}. Phase 4
 * ships the type only — the runtime validator lands in Phase 5
 * (PLAN §9.5). Adapters declare their custom-feed shape today;
 * scripts read the typed `Series<T>` at runtime.
 *
 * @since 0.4
 * @experimental
 * @example
 *     const s: Schema<number> = { kind: "external-series-schema" };
 *     void s;
 */
export type Schema<T> = { readonly kind: "external-series-schema" } & { __brand?: T };

/**
 * Typed input descriptor — what every `input.*` builder returns.
 * The discriminated `kind` matches {@link InputKind}; the
 * remaining fields carry the default value + UI hints.
 *
 * @since 0.4
 * @example
 *     const d: InputDescriptor<number> = {
 *         kind: "int",
 *         defaultValue: 14,
 *         title: "Length",
 *     };
 *     void d;
 */
export type InputDescriptor<T> =
    | IntDescriptor
    | FloatDescriptor
    | BoolDescriptor
    | StringDescriptor
    | EnumDescriptor<string>
    | ColorDescriptor
    | SourceDescriptor
    | TimeDescriptor
    | PriceDescriptor
    | SymbolDescriptor
    | IntervalDescriptorInput
    | ExternalSeriesDescriptor<T>;

type Common<K extends InputKind, T> = Readonly<{
    kind: K;
    defaultValue: T;
    title?: string;
}>;

export type IntDescriptor = Common<"int", number> & Readonly<{ min?: number; max?: number; step?: number }>;
export type FloatDescriptor = Common<"float", number> & Readonly<{ min?: number; max?: number; step?: number }>;
export type BoolDescriptor = Common<"bool", boolean>;
export type StringDescriptor = Common<"string", string> & Readonly<{ multiline?: boolean }>;
export type EnumDescriptor<T extends string> = Common<"enum", T> & Readonly<{ options: ReadonlyArray<T> }>;
export type ColorDescriptor = Common<"color", Color>;
export type SourceDescriptor = Common<"source", SourceField>;
export type TimeDescriptor = Common<"time", number> & Readonly<{ pickFromChart?: boolean }>;
export type PriceDescriptor = Common<"price", number>;
export type SymbolDescriptor = Common<"symbol", string>;
export type IntervalDescriptorInput = Common<"interval", string>;
export type ExternalSeriesDescriptor<T> = Readonly<{
    kind: "external-series";
    name: string;
    schema: Schema<T>;
    title?: string;
}>;
```

### 2. `packages/core/src/input/input.ts`

Implement the 12 builders. Each is a **pure factory** — no
runtime side effects. The compiler walks the AST for these calls
at `defineIndicator({ inputs: { ... } })` and serialises the
descriptor literal into `manifest.inputs`.

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Color, Price, Time } from "../types";
import type {
    BoolDescriptor, ColorDescriptor, EnumDescriptor,
    ExternalSeriesDescriptor, FloatDescriptor, IntDescriptor,
    IntervalDescriptorInput, PriceDescriptor, Schema,
    SourceDescriptor, SourceField, StringDescriptor,
    SymbolDescriptor, TimeDescriptor,
} from "./inputDescriptor";

/**
 * The `input.*` namespace. PLAN.md §12. Every builder is a
 * compile-time literal — the compiler reads the call expression
 * and serialises the descriptor into `manifest.inputs`. The
 * runtime never executes these calls; they exist as pure factories
 * for the TypeScript type system + the compiler AST walker.
 *
 * @since 0.4
 * @example
 *     import { input } from "@invinite-org/chartlang-core";
 *     const length = input.int(20, { min: 1, max: 200, title: "Length" });
 *     void length;
 */
export const input = Object.freeze({
    int(defaultValue: number, opts?: { min?: number; max?: number; step?: number; title?: string }): IntDescriptor {
        return Object.freeze({ kind: "int" as const, defaultValue, ...opts });
    },
    float(defaultValue: number, opts?: { min?: number; max?: number; step?: number; title?: string }): FloatDescriptor {
        return Object.freeze({ kind: "float" as const, defaultValue, ...opts });
    },
    bool(defaultValue: boolean, opts?: { title?: string }): BoolDescriptor {
        return Object.freeze({ kind: "bool" as const, defaultValue, ...opts });
    },
    string(defaultValue: string, opts?: { title?: string; multiline?: boolean }): StringDescriptor {
        return Object.freeze({ kind: "string" as const, defaultValue, ...opts });
    },
    enum<T extends string>(
        defaultValue: T,
        options: ReadonlyArray<T>,
        opts?: { title?: string },
    ): EnumDescriptor<T> {
        return Object.freeze({ kind: "enum" as const, defaultValue, options: Object.freeze(options.slice()), ...opts });
    },
    color(defaultValue: Color, opts?: { title?: string }): ColorDescriptor {
        return Object.freeze({ kind: "color" as const, defaultValue, ...opts });
    },
    source(defaultValue: SourceField, opts?: { title?: string }): SourceDescriptor {
        return Object.freeze({ kind: "source" as const, defaultValue, ...opts });
    },
    time(defaultValue: Time, opts?: { title?: string; pickFromChart?: boolean }): TimeDescriptor {
        return Object.freeze({ kind: "time" as const, defaultValue, ...opts });
    },
    price(defaultValue: Price, opts?: { title?: string }): PriceDescriptor {
        return Object.freeze({ kind: "price" as const, defaultValue, ...opts });
    },
    symbol(defaultValue: string, opts?: { title?: string }): SymbolDescriptor {
        return Object.freeze({ kind: "symbol" as const, defaultValue, ...opts });
    },
    interval(defaultValue: string, opts?: { title?: string }): IntervalDescriptorInput {
        return Object.freeze({ kind: "interval" as const, defaultValue, ...opts });
    },
    externalSeries<T>(args: { name: string; schema: Schema<T>; title?: string }): ExternalSeriesDescriptor<T> {
        return Object.freeze({ kind: "external-series" as const, name: args.name, schema: args.schema, title: args.title });
    },
});
```

### 3. `packages/core/src/input/index.ts` barrel

```ts
export { input } from "./input";
export type {
    BoolDescriptor, ColorDescriptor, EnumDescriptor,
    ExternalSeriesDescriptor, FloatDescriptor, IntDescriptor,
    InputDescriptor, InputKind, IntervalDescriptorInput,
    PriceDescriptor, Schema, SourceDescriptor, SourceField,
    StringDescriptor, SymbolDescriptor, TimeDescriptor,
} from "./inputDescriptor";
```

### 4. `packages/core/src/types.ts` — widen `InputSchema`

Replace the Phase-1 opaque placeholder with the typed shape.
JSDoc updates to `@since 0.1 — widened in 0.4`.

```ts
import type { InputDescriptor } from "./input/inputDescriptor";

/**
 * Script-author-declared input schema attached to `defineIndicator`
 * / `defineAlert` / `defineDrawing`. Each key carries an
 * `InputDescriptor<T>` returned by an `input.*` builder. The
 * compiler walks the descriptor at `defineIndicator({ inputs:
 * { ... } })` and serialises it into `manifest.inputs`; the
 * runtime resolves user-supplied overrides against the default
 * before handing the bag to `compute({ inputs })`.
 *
 * @since 0.1
 * @example
 *     import { input } from "@invinite-org/chartlang-core";
 *     const inputs: InputSchema = { length: input.int(20) };
 *     void inputs;
 */
export type InputSchema = Readonly<Record<string, InputDescriptor<unknown>>>;
```

### 5. `packages/core/src/index.ts` — re-exports

Append:

```ts
export { input } from "./input";
export type {
    BoolDescriptor, ColorDescriptor, EnumDescriptor,
    ExternalSeriesDescriptor, FloatDescriptor, IntDescriptor,
    InputDescriptor, InputKind, IntervalDescriptorInput,
    PriceDescriptor, Schema, SourceDescriptor, SourceField,
    StringDescriptor, SymbolDescriptor, TimeDescriptor,
} from "./input";
```

### 6. Tests

- **`input.test.ts`** — one assertion per builder verifying the
  returned descriptor shape (kind + defaultValue + opts pass-
  through). Cover the `Object.freeze` invariant (mutation throws
  in strict mode).
- **`input.types.test.ts`** — `expect-type` assertions:
  `expectType<IntDescriptor>(input.int(20))`,
  `expectType<EnumDescriptor<"a" | "b">>(input.enum("a", ["a", "b"] as const))`,
  `expectType<InputDescriptor<unknown>>(input.bool(true))`.
- **`inputDescriptor.types.test.ts`** — `expectType` over the
  union narrowing (`d.kind === "int"` narrows to `IntDescriptor`).

### 7. JSDoc gate

Every exported builder + every descriptor type carries `@since 0.4`,
`@example` (compileable), no `@experimental` (the inputs surface
is stable on landing — adapters in consumer repos already pin
against the `InputKind` shape).

`pnpm docs:check` must execute the `@example` blocks.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/input/input.ts` | Create | 12 `input.*` builder implementations |
| `packages/core/src/input/inputDescriptor.ts` | Create | `InputDescriptor<T>` union + `InputKind` + `SourceField` + `Schema<T>` |
| `packages/core/src/input/index.ts` | Create | Barrel re-export |
| `packages/core/src/input/input.test.ts` | Create | Unit tests over builder return shapes |
| `packages/core/src/input/input.types.test.ts` | Create | `expect-type` over builder return types |
| `packages/core/src/input/inputDescriptor.types.test.ts` | Create | `expect-type` over the union narrowing |
| `packages/core/src/types.ts` | Modify | Widen `InputSchema` to `Readonly<Record<string, InputDescriptor<unknown>>>` |
| `packages/core/src/index.ts` | Modify | Re-export `input` + 13 input types |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage on `packages/core/`)
- `pnpm docs:check` (new JSDoc `@example` blocks compile)
- `pnpm readme:check` (no README changes; gate stays green)

## Changeset

`.changeset/phase-4-task-01-core-input-builders.md` — **minor** on
`@invinite-org/chartlang-core`. Note that `InputSchema`'s widening
is type-narrowing only — existing scripts still typecheck because
the previous opaque record covers the new typed shape.

## Acceptance Criteria

- `import { input } from "@invinite-org/chartlang-core"` resolves
  to the namespace with 12 builders.
- Every builder returns a frozen descriptor with the expected
  `kind` discriminator.
- `InputSchema` widens without breaking Phase-1/2/3 example
  scripts (`pnpm cli e2e.test.ts` stays green).
- Type tests assert correct discriminator narrowing.
- 100% coverage on the new files; index/types barrels excluded.
- JSDoc `@since 0.4` + compileable `@example` on every export.
- Changeset committed.
