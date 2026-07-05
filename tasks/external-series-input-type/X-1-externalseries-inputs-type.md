# Type the `compute` `inputs` bag per-descriptor (external-series → `Series<T>`)

> **Status: TODO**

## Goal

Make the `compute({ inputs })` bag **typed per input descriptor**. Today
`ComputeContext.inputs` is `Readonly<Record<string, unknown>>` in **both**
core (`packages/core/src/types.ts:824`) and the compiler ambient shim
(`packages/compiler/src/program.ts:1548`), so every input reads as `unknown`
and casts are required. Introduce a generic inputs-typing mechanism so each
descriptor resolves to its runtime value type — the headline being
`input.externalSeries<T>(...)` → `Series<T>`, read cast-free. Pure TYPE-surface
change: the runtime already hands `compute` the series view
(`resolveInputs.ts:54` → `ctx.externalSeriesSlots.get(key)?.view`). Do **not**
change runtime behavior or the emitted manifest.

## Prerequisites

None. Work is in `packages/core/` and `packages/compiler/` (the shim), which
must stay in lockstep.

## Current Behavior

- `packages/core/src/input/input.ts:294-301` — `externalSeries<T>(args:
  ExternalSeriesArgs<T>): ExternalSeriesDescriptor<T>` (discriminant
  `kind: "external-series"`). `T` is inferred from the `schema` arg; there is
  **no** `<T = number>` default.
- `packages/core/src/input/inputDescriptor.ts:318-324` —
  `ExternalSeriesDescriptor<T>`. All other descriptors are
  `Common<K extends InputKind, T>` discriminated by `kind`
  (`int`/`float`/`bool`/`string`/`enum`/`color`/`source`/`time`/`price`/
  `symbol`/`interval`/`session`).
- **No descriptor → value map exists.** `ComputeContext.inputs` is
  `Readonly<Record<string, unknown>>` (`types.ts:824`); `ComputeFn`
  (`types.ts:886`) and all four `define*` constructors are **non-generic**
  (`define/defineIndicator.ts`, `defineAlert.ts`, `defineDrawing.ts`,
  `defineAlertCondition.ts` — each has `inputs?: InputSchema` +
  `compute: ComputeFn`, with zero linkage between them). The compiler shim
  mirrors all of this (`program.ts:1546-1624`).
- `Series<T>` is already defined (`types.ts:159-163`) and barrel-exported
  (`index.ts:32`).
- Type tests: `packages/core/src/input/input.types.test.ts` pins **descriptor
  factory** return types only (`expectTypeOf(input.externalSeries({...}))
  .toEqualTypeOf<ExternalSeriesDescriptor<number>>()`, lines 59-64); no
  `compute`-level `inputs`-value assertion exists anywhere.
- **Corpus** (informational): 22 example scripts in `examples/scripts/*.chart.ts`
  cast inputs (`inputs.length as number`, `inputs.src as SourceField`,
  `inputs.earnings as Series<number>`, …). These casts stay valid after
  tightening **iff** the map yields exactly the cast targets (redundant but
  legal). No `inputs.` reads in `packages/conformance/scenarios/`.

## Desired Behavior

- In a `compute({ inputs })` body, `inputs.<key>` types as the **runtime value
  type** for that key's descriptor:
  - `input.externalSeries<T>` → `Series<T>` (default `Series<number>` — see
    Requirement 4 on the omitted-generic default),
  - `int`/`float`/`time`/`price` → `number`, `bool` → `boolean`,
    `enum<U>` → `U`, `color`/`string`/`symbol`/`interval`/`session` → `string`,
    `source` → `SourceField`.
- `inputs.<externalSeriesKey>.current`, `[n]`, `.length`, and passing it to
  `ta.*` (param `ScalarOrSeries = number | Series<number>`) type-check with NO
  cast.
- `const n: number = inputs.<externalSeriesKey>` is a **type error** (TS2322).
- A script that declares no `inputs` keeps `inputs` effectively
  `Readonly<Record<string, unknown>>` — existing snapshots / typechecks
  unchanged.
- Manifest + runtime output byte-identical.

## Requirements

### 1. Add the descriptor → value mapped type (core)

In `packages/core/src/` add a per-descriptor value map. Sketch (verify against
`resolveInputs`, Requirement 2):

```ts
type ResolveInputValue<D> =
    D extends ExternalSeriesDescriptor<infer T> ? Series<T> :
    D extends EnumDescriptor<infer U> ? U :
    D extends { kind: "int" | "float" | "time" | "price" } ? number :
    D extends { kind: "bool" } ? boolean :
    D extends { kind: "color" | "string" | "symbol" | "interval" | "session" } ? string :
    D extends { kind: "source" } ? SourceField :
    unknown;

type ResolvedInputs<I extends InputSchema> = {
    readonly [K in keyof I]: ResolveInputValue<I[K]>;
};
```

This is a **declarations-only** type — put it where core keeps type
declarations (`types.ts` / the `input/` types module) so it is coverage-excluded
(no runtime code). Export it if the compiler/tests import it; otherwise keep it
package-internal.

### 2. Anchor every value type to `resolveInputs` (single source of truth)

The whole bug was **type ≠ runtime**. Each arm of `ResolveInputValue` MUST equal
the type `packages/runtime/src/inputs/resolveInputs.ts` writes to `out[key]` for
that `descriptor.kind`. Confirm the mapping table above against `resolveInputs`
(and `externalSeriesFeeds.ts:19-24` for the `Series<number>` view); if runtime
differs for any kind, the map follows runtime, not this sketch. In particular
confirm `source` resolves to the `SourceField` string (matching the existing
`inputs.src as SourceField` cast), not a series.

### 3. Thread the generic through all four `define*` constructors + `ComputeContext` (core)

- Make `ComputeContext` generic:
  `ComputeContext<TInputs = Readonly<Record<string, unknown>>>` with
  `readonly inputs: TInputs`. Make `ComputeFn` generic:
  `ComputeFn<TInputs = Readonly<Record<string, unknown>>> = (ctx:
  ComputeContext<TInputs>) => void`.
- Make each opts type + constructor generic over the concrete schema:
  `defineIndicator<I extends InputSchema = InputSchema>(opts:
  DefineIndicatorOpts<I>)`, with `DefineIndicatorOpts<I>` carrying
  `inputs?: I; compute: ComputeFn<ResolvedInputs<I>>`. Do the SAME for
  `defineAlert` / `defineDrawing` / `defineAlertCondition` — all four share the
  bag; leaving any one non-generic leaves those scripts untyped.
- **Back-compat default:** a script that omits `inputs` (or whose `inputs`
  cannot be inferred to a concrete literal shape) must keep `inputs` as
  `Readonly<Record<string, unknown>>`, NOT a distributed union over all
  descriptor kinds. Pick the default (`I = InputSchema` plus a `TInputs` default,
  or `I = {}`) that preserves this. Add a type test proving the no-inputs case is
  unchanged.

### 4. Default the external-series generic to `number` when omitted

`input.externalSeries(...)` with the generic omitted currently infers
`T = unknown` (the `Schema<T>` `__brand?: T` is optional, so no inference site).
`Series<unknown>` is not what the runtime provides. Ensure the resolved type
defaults to `Series<number>` when `<T>` is omitted — via a `<T = number>`
default on `ExternalSeriesArgs`/`ExternalSeriesDescriptor`/`Schema`, or a
`Series<T extends unknown ? number : T>` guard in `ResolveInputValue`. Keep the
descriptor factory return type and `input.types.test.ts:59-64` assertion valid.

### 5. Mirror everything in the compiler ambient shim — lockstep (compiler)

`packages/compiler/src/program.ts` `CORE_AMBIENT_SHIM` is the surface that
actually types a script's `inputs`. Mirror in lockstep:
- `ResolveInputValue` + `ResolvedInputs` (add to the shim),
- generic `ComputeContext` / `ComputeFn` (`:1546-1568`),
- generic `Define*Opts` + `define*` decls (`:1592-1624`),
- the external-series `number` default (Requirement 4).
Structural identity with core is the invariant (`packages/compiler/CLAUDE.md`).

### 6. Tests

**Core** — add `compute`-level assertions (in
`define/defineIndicator.types.test.ts`, which already type-tests
`DefineIndicatorOpts`; keep the descriptor assertions in
`input/input.types.test.ts`). Using `defineIndicator` + `expectTypeOf` on
`ctx.inputs.<key>`:
- `inputs.<externalSeriesKey>` is `Series<number>` for
  `input.externalSeries<number>(...)` **and** for the omitted-generic form
  (Requirement 4); `Series<T>` for a non-number `T`,
- `inputs.<externalSeriesKey>.current` is `number`,
- passing it to a `ta.*` (`ScalarOrSeries`) type-checks,
- one representative per other kind (`int` → `number`, `bool` → `boolean`,
  `enum` → its union, `source` → `SourceField`, a string-family → `string`),
- **negative:** `// @ts-expect-error` on `const n: number = inputs.<key>` for the
  external-series key (do NOT use a `typeof … === "number"` guard — it still
  compiles),
- the no-inputs default case stays `Record<string, unknown>` (Requirement 3).

**Compiler** — add a test (co-located with the existing `packages/compiler/src`
compile tests) that runs `compile` on the canonical consumer (Requirement 7)
and asserts `ok: true`, 0 diagnostics; plus a negative asserting a diagnostic
when the external-series input is assigned to a `number`.

### 7. Prove the canonical consumer compiles cast-free

This body must type-check with NO `as Series<number>` cast (external-series read
cast-free; `inputs.smoothLength` also resolves to `number` now, so it needs no
cast either):

```ts
compute({ inputs, ta, plot }) {
    const bound = inputs.bound;                       // Series<number>, no cast
    const smoothed = ta.sma(bound, inputs.smoothLength); // smoothLength: number
    plot(bound.current, { title: "Bound" });
    plot(smoothed.current, { title: "Bound SMA", lineWidth: 2 });
}
```

### 8. De-cast the skill + amend the invariants (same PR)

The "narrow with `as number`" rule is now wrong. Per the repo's cross-cutting
rules, in the SAME PR:
- `skills/chartlang-coding/SKILL.md:181-182,190-192,381` — drop the "must cast"
  rule; show cast-free reads (a cast stays legal but is no longer required).
- `skills/chartlang-coding/references/examples.md:134`,
  `references/translating-from-pine.md:208-209,497`,
  `references/forbidden.md:78` — update the `inputs.<x> as …` examples.
  (`references/primitives.md` is generated — do NOT hand-edit; `pnpm
  skills:generate` + `skills:gate` cover it.)
- `packages/compiler/CLAUDE.md:75-78` — amend the invariant that grounds the
  "cast needed" convention on `inputs` being `Record<string, unknown>` (the
  cast is no longer needed; the pine-converter's emitted `as string` still
  works as a now-redundant cast). Note `CLAUDE.md:178` (`inputs.len as number`)
  reads fine unchanged.
- `packages/core/CLAUDE.md` — add a short invariant: the `inputs` bag is typed
  per-descriptor via `ResolvedInputs`, in lockstep with the compiler shim;
  value types equal `resolveInputs` output.

### 9. Docs + changeset

- `.changeset/*.md` — `@invinite-org/chartlang-core` **and**
  `@invinite-org/chartlang-compiler`: **minor** (additive typed-inputs feature;
  no runtime/manifest change — the `define*` generics carry defaults so direct
  TS API consumers are source-compatible; script diagnostics tighten). Describe:
  the `compute` `inputs` bag now types per input descriptor
  (external-series → `Series<T>`), casts no longer required; guards against the
  "treat the view as a plain number" mistake.
- No hand-edited generated docs; `pnpm docs:check` / `pnpm readme:check` stay
  green.

## Files to Create / Modify

| File                                                              | Action | Purpose                                                     |
| ----------------------------------------------------------------- | ------ | ---------------------------------------------------------- |
| `packages/runtime/src/inputs/resolveInputs.ts`                    | Read   | Source of truth for each descriptor's runtime value type   |
| `packages/core/src/input/inputDescriptor.ts`                      | Read/Modify | Confirm descriptors; add external-series `<T = number>` default (R4) |
| `packages/core/src/types.ts` (or `input/` types module)           | Modify | `ResolveInputValue` + `ResolvedInputs`; generic `ComputeContext`/`ComputeFn` |
| `packages/core/src/define/defineIndicator.ts`                     | Modify | Generic `DefineIndicatorOpts<I>` + constructor              |
| `packages/core/src/define/defineAlert.ts`                         | Modify | Generic (lockstep with indicator)                          |
| `packages/core/src/define/defineDrawing.ts`                       | Modify | Generic (lockstep)                                         |
| `packages/core/src/define/defineAlertCondition.ts`               | Modify | Generic (lockstep)                                         |
| `packages/core/src/input/input.ts`                                | Read/Modify | External-series `<T = number>` default site (R4)      |
| `packages/compiler/src/program.ts` (`CORE_AMBIENT_SHIM`)          | Modify | Mirror the map + generics in the shim, `:1546-1624` (R5)   |
| `packages/core/src/define/defineIndicator.types.test.ts`          | Modify | `compute`-level `inputs`-value type assertions (R6)        |
| `packages/core/src/input/input.types.test.ts`                     | Modify | Keep descriptor assertions; external-series default        |
| `packages/compiler/src/*.test.ts` (compile tests)                 | Modify | Canonical consumer compiles cast-free; negative diagnostic |
| `skills/chartlang-coding/SKILL.md`                                | Modify | Drop "must cast" rule; cast-free reads (R8)                |
| `skills/chartlang-coding/references/examples.md`                  | Modify | Update `inputs.<x> as …` example                          |
| `skills/chartlang-coding/references/translating-from-pine.md`     | Modify | Update cast examples                                       |
| `skills/chartlang-coding/references/forbidden.md`                 | Modify | Update cast example                                        |
| `packages/compiler/CLAUDE.md`                                     | Modify | Amend the `Record<string, unknown>` cast invariant (R8)   |
| `packages/core/CLAUDE.md`                                         | Modify | Add typed-inputs invariant (R8)                           |
| `.changeset/typed-inputs-bag.md`                                  | Create | core + compiler **minor**                                 |

## Gates

- `pnpm -F @invinite-org/chartlang-core test` (unit + type layers) green.
- `pnpm -F @invinite-org/chartlang-compiler test` green (incl. new compile test).
- `pnpm typecheck` green across the workspace (example scripts with now-redundant
  casts still type-check).
- `pnpm lint` green.
- `pnpm conformance` byte-identical (no manifest/runtime change).
- `pnpm skills:gate` + `pnpm skills:generate` clean; `pnpm docs:check`;
  `pnpm readme:check`.

## Acceptance Criteria

- [ ] `ComputeContext.inputs` is typed per-descriptor via `ResolvedInputs` in
      **both** core and the compiler shim (lockstep); no-inputs scripts keep
      `Readonly<Record<string, unknown>>`.
- [ ] `inputs.<externalSeriesKey>` types as `Series<T>` (default `Series<number>`
      when the generic is omitted); `.current`/`[n]`/`.length` and `ta.*` use
      type-check with **no** cast.
- [ ] Every non-external descriptor resolves to the type `resolveInputs` writes
      at runtime (verified against `resolveInputs.ts`, not assumed).
- [ ] The canonical consumer body (R7) compiles cast-free (compiler test asserts
      `ok: true`, 0 diagnostics); `const n: number = inputs.<externalSeriesKey>`
      is a type error (negative test present; NOT a `typeof` guard).
- [ ] All four `define*` constructors are generic in lockstep across core + shim.
- [ ] Skill (`SKILL.md` + 3 reference files) de-casted; `packages/core/CLAUDE.md`
      + `packages/compiler/CLAUDE.md` invariants amended — all in this PR.
- [ ] Type + compile tests added; runtime/manifest byte-identical; `pnpm
      conformance` unchanged.
- [ ] Changeset present — core + compiler **minor**; standard changesets release.
