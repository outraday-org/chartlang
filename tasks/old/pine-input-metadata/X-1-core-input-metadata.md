# Task 1 — Core input metadata fields (group / inline / tooltip / display / confirm)

> **Status: Complete + Ship**

## Goal

Add five presentation-only metadata fields — `group?`, `inline?`,
`tooltip?`, `display?`, `confirm?` — to every chartlang `input.*` descriptor
and builder, and mirror them in the compiler's `program.ts` ambient shim, so
the manifest can carry Pine-style panel layout. This is a pure type/contract
+ builder addition; no runtime resolution changes.

## Prerequisites

None.

## Current Behavior

`Common<K, T>` (`packages/core/src/input/inputDescriptor.ts:87`) is the
shared descriptor base:

```ts
type Common<K extends InputKind, T> = Readonly<{
    kind: K;
    defaultValue: T;
    title?: string;
}>;
```

Each builder in `input.ts` accepts a narrow per-kind opts object (e.g.
`int(defaultValue, { min?, max?, step?, title? })`). The compiler's
`extractInputs.ts` `copyObjectLiteralFields` already copies any
literal-valued property from the opts object into the manifest descriptor,
so new opts serialise generically once the types accept them.

## Desired Behavior

Every `input.*` descriptor and builder accepts the five new optional fields;
they round-trip into `manifest.inputs` unchanged; `resolveInputs` ignores
them (no value impact). `manifest.inputs` declaration order is preserved
(pin with a test).

## Requirements

### 1. Add the shared metadata mixin (`packages/core/src/input/inputDescriptor.ts`)

Introduce an exported display union and a `CommonInputOpts` mixin, and fold
it into `Common<K, T>` and `ExternalSeriesDescriptor<T>`:

```ts
/**
 * Where an input's value is surfaced outside the settings panel. Mirrors
 * Pine's `display.*`; omitted ⇒ `"all"`. Presentation-only — the runtime
 * ignores it.
 *
 * @since 1.8
 * @stable
 * @example
 *     const d: InputDisplay = "data-window";
 *     void d;
 */
export type InputDisplay = "all" | "status-line" | "data-window" | "none";

/**
 * Presentation/help metadata shared by every `input.*` descriptor. All fields
 * are optional and ignored by value resolution; adapters read them to lay out
 * a settings panel (Pine `group`/`inline`/`tooltip`/`display`/`confirm`).
 *
 * @since 1.8
 * @stable
 * @example
 *     const m: CommonInputOpts = { group: "Trend", inline: "row1", tooltip: "…" };
 *     void m;
 */
export type CommonInputOpts = Readonly<{
    group?: string;
    inline?: string;
    tooltip?: string;
    display?: InputDisplay;
    confirm?: boolean;
}>;
```

Update `Common<K, T>`:

```ts
type Common<K extends InputKind, T> = Readonly<{
    kind: K;
    defaultValue: T;
    title?: string;
}> &
    CommonInputOpts;
```

Update `ExternalSeriesDescriptor<T>` to intersect `CommonInputOpts` too
(it does not use `Common`):

```ts
export type ExternalSeriesDescriptor<T> = Readonly<{
    kind: "external-series";
    name: string;
    schema: Schema<T>;
    title?: string;
}> &
    CommonInputOpts;
```

No change to `IntDescriptor`/`FloatDescriptor`/etc. — they inherit via
`Common`. The `NumericInputOpts` (`min`/`max`/`step`) stays separate.

### 2. Widen every builder opts type (`packages/core/src/input/input.ts`)

Define a single reusable opts fragment and spread it into every builder's
`opts` parameter type so authors can pass the metadata to any input. Add
`& CommonInputOpts` to each builder's inline opts object type. Builders to
update (all 13): `int`, `float`, `bool`, `string`, `enum`, `color`,
`source`, `time`, `price`, `symbol`, `interval`, `session`, `externalSeries`.

Example for `int`:

```ts
int(
    defaultValue: number,
    opts?: {
        readonly min?: number;
        readonly max?: number;
        readonly step?: number;
        readonly title?: string;
    } & CommonInputOpts,
): IntDescriptor {
    return Object.freeze({ kind: "int" as const, defaultValue, ...opts });
}
```

`externalSeries` currently builds its descriptor with an explicit
`title`-only spread — extend it to forward the metadata fields the same way
it forwards `title` (only include defined keys to preserve
`exactOptionalPropertyTypes`). The `enum` builder keeps `options` as its
second positional arg; add `& CommonInputOpts` to its third `opts` param.

The `Object.freeze({ kind, defaultValue, ...opts })` spread already carries
any present field — only the **types** widen.

### 3. Mirror in the compiler ambient shim (`packages/compiler/src/program.ts`)

Locate the `Common`/`InputDescriptor` mirror in the shim and add the
identical `InputDisplay` + `CommonInputOpts` types, intersect them into the
shim's `Common` and external-series descriptor, and widen each builder's
opts type to `& CommonInputOpts`. The shim must accept a script written as:

```ts
input.int(20, { title: "Length", group: "MA", inline: "1", tooltip: "…",
    display: "data-window", confirm: true })
```

so the full `compile()` type-check passes. Keep the shim **byte-aligned**
with `inputDescriptor.ts` + `input.ts` (the lockstep rule in
`packages/compiler/CLAUDE.md`).

### 4. Export the new public types (`packages/core/src/input/index.ts` + root barrel)

Export `InputDisplay` and `CommonInputOpts` from
`packages/core/src/input/index.ts` and from the root
`packages/core/src/index.ts` input type export block. These types are public
API used by adapters/docs and must not remain trapped in `inputDescriptor.ts`.

### 5. Confirm serialisation

`extractInputs.copyObjectLiteralFields` copies any literal-valued opts
property; `readLiteral` already handles string + boolean literals. Verify
`group`/`inline`/`tooltip` (strings), `display` (string), `confirm`
(boolean) serialise into the descriptor. Add a compiler unit test in
`packages/compiler/src/analysis/extractInputs.test.ts` asserting a descriptor
with all five fields round-trips into the manifest with the exact values,
**and** that two inputs declared in order `a`, `b` appear in `manifest.inputs`
in that order (the ordering guarantee `groupInputs` relies on). If a snapshot
test exists, regenerate it.

Important: `input.externalSeries(...)` is handled by
`serialiseExternalSeries`, not by the generic `copyObjectLiteralFields` path.
Update `serialiseExternalSeries` to copy literal
`group`/`inline`/`tooltip`/`display`/`confirm` in addition to `title`, with the
same literal-only diagnostics as the generic path, and cover this in the
compiler test.

### 6. Tests

- `packages/core/src/input/input.test.ts`: assert each builder returns a
  frozen descriptor carrying the five fields when passed; assert omitting
  them yields a descriptor without the keys (no `undefined` leakage), so
  `apiVersion: 1` manifests stay byte-identical when metadata is unused.
- `packages/core/src/input/inputDescriptor.types.test.ts` (or the existing
  `*.types.test.ts`): `expect-type` that `CommonInputOpts` is assignable to
  every descriptor's optional surface and that `display` only accepts the
  four literals.
- Runtime: add one case to the resolveInputs test asserting a descriptor
  carrying `group`/`tooltip` resolves to the **same value** as one without
  (metadata does not change resolution).

### 7. Skill sync (root `CLAUDE.md` rule)

Update `skills/chartlang-coding/SKILL.md` (and
`skills/chartlang-coding/references/translating-from-pine.md` if it lists the
`input.*` opts surface) to document the five new opts. `pnpm skills:generate`
does NOT emit `input.*` (it covers `ta`/`draw`/plot/`math`/`str`), so this is
a hand edit — but run `pnpm skills:gate` to confirm nothing regressed.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/input/inputDescriptor.ts` | Modify | `InputDisplay` + `CommonInputOpts`; fold into `Common` + external-series |
| `packages/core/src/input/input.ts` | Modify | Widen 13 builder opts types |
| `packages/core/src/input/index.ts` | Modify | Export `InputDisplay` + `CommonInputOpts` from the input barrel |
| `packages/core/src/index.ts` | Modify | Re-export `InputDisplay` + `CommonInputOpts` from the package root |
| `packages/core/src/input/input.test.ts` | Modify | Unit coverage for the 5 fields |
| `packages/core/src/input/*.types.test.ts` | Modify | `expect-type` coverage |
| `packages/compiler/src/program.ts` | Modify | Mirror shim in lockstep |
| `packages/compiler/src/analysis/extractInputs.ts` | Modify | Copy metadata from `input.externalSeries(...)` descriptors |
| `packages/compiler/src/analysis/extractInputs.test.ts` | Modify | Round-trip + ordering test |
| `packages/runtime/src/inputs/resolveInputs.test.ts` | Modify | Metadata-ignored-by-resolution case |
| `skills/chartlang-coding/SKILL.md` | Modify | Document new opts |
| `.changeset/core-input-metadata-fields.md` | Create | Changeset |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (coverage 100% on core/compiler/runtime touched files)
- `pnpm docs:check` (new core exports `InputDisplay`, `CommonInputOpts` need
  `@example`/`@since`/stability)
- `pnpm skills:gate`

## Changeset

`.changeset/core-input-metadata-fields.md` — **minor** bump for
`@invinite-org/chartlang-core` and `@invinite-org/chartlang-compiler`
(additive `apiVersion: 1` surface).

## Acceptance Criteria

- All 13 builders accept `group`/`inline`/`tooltip`/`display`/`confirm`;
  descriptors carry them frozen; omitted fields leave no key.
- `InputDisplay` and `CommonInputOpts` are exported from both the input barrel
  and package root.
- A script using all five opts type-checks through `compile()` (shim
  lockstep verified).
- A descriptor with all five fields round-trips into `manifest.inputs`;
  `input.externalSeries(...)` metadata serialises too; declaration order
  preserved.
- `resolveInputs` output is unchanged by the presence of metadata.
- New core exports carry JSDoc with `@example`/`@since 1.8`/`@stable`
  (the `@since` value tracks the workspace release train — currently `1.8`,
  in-flight on this branch — not the per-package semver; confirm `1.8` is
  still the active train at execution time);
  `docs:check` + `skills:gate` green; 100% coverage on touched packages.
- Changeset committed.
