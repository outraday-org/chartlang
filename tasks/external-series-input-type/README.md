# Type the `compute` `inputs` bag per-descriptor (fixes external-series `Series<T>`)

> **Status: TODO** — type-surface feature. Motivated by the external-series
> `Series<T>` bug; the mechanism types the whole `inputs` bag.

## Overview

An `input.externalSeries<T>({ ... })` input resolves to **`unknown`** on the
`compute({ inputs })` bag — even with the explicit `<number>` generic. So the
correct usage — reading the series view via `inputs.bound.current` /
`inputs.bound[n]` / feeding it to `ta.*` — does **not** type-check cast-free,
and authors are forced to cast (`inputs.bound as Series<number>`) or, worse, to
"fix" the type error by treating the input as a plain number.

That exact mis-port shipped in a downstream same-chart series consumer and made
it **render nothing**:

```ts
const fed = inputs.bound;
const value = typeof fed === "number" ? fed : NaN; // ← ALWAYS NaN
```

`inputs.bound` is a `Series<number>` **view object** (`typeof === "object"`),
so the guard is always false and every plotted value is `NaN`. The runtime,
hosts, feed pipeline, and buffer capacity were all correct — the wrong `inputs`
type was the only reason a wrong (and silently-broken) script compiled.

## Why this is broader than "add the external-series case"

**There is no descriptor → value map to add a case to.** Verified against the
workspace:

- `packages/core/src/types.ts:824` — `ComputeContext.inputs` is
  `Readonly<Record<string, unknown>>`. `ComputeFn` (`types.ts:886`) is
  **non-generic**.
- The compiler's ambient shim mirrors this exactly:
  `packages/compiler/src/program.ts:1548` — the shim's `ComputeContext.inputs`
  is also `Readonly<Record<string, unknown>>`. **The shim is what actually
  types a script's `inputs`**, so the observable fix comes from the shim; core
  must match it in lockstep.
- There is **no** `ResolveInputValue` / `{ [K in keyof I]: … }` mapped type
  anywhere. **Every** input — `int`, `color`, `externalSeries` alike — reads as
  `unknown`, and casting (`inputs.x as number`) is the codebase's current,
  skill-taught convention (`packages/compiler/CLAUDE.md:75-78`;
  `skills/chartlang-coding/SKILL.md:190-192`).

So external-series is not a "missing case in an otherwise-working map." Typing
`inputs.bound` as `Series<T>` cast-free requires **introducing** a generic
inputs-typing mechanism: make the four `define*` constructors generic over their
`inputs` schema and thread a per-descriptor value map into `ComputeContext`,
mirrored in the compiler shim in lockstep. That is the scope of this task.

**Scope decision (confirmed with the user):** map **every** descriptor kind to
its resolved value type (not external-series alone). Casts become redundant but
stay valid for well-written scripts (see corpus note); mis-casts — the class of
bug this fixes — now error.

## Goal

Make the `compute({ inputs })` bag **typed per input descriptor**, so:

- `input.externalSeries<T>(...)` → `Series<T>` (default `Series<number>`);
  `.current` / `[n]` / `.length` and feeding `ta.*` type-check with **no** cast,
  and `const n: number = inputs.<externalSeriesKey>` is a **type error**.
- every other descriptor resolves to the exact type `resolveInputs` hands the
  script at runtime (`int`/`float` → `number`, `bool` → `boolean`, `enum<U>` →
  `U`, `source` → `SourceField`, string-family → `string`, …).

Runtime behavior and the emitted manifest are **byte-identical** (pure type
surface). The one observable change is stricter compiler diagnostics: reading an
input at the wrong type no longer compiles.

> **Not fixed by typing alone:** `typeof inputs.bound === "number"` still
> *compiles* (the branch narrows to `never`), so a `typeof` guard cannot be the
> negative test. The real guarantees are: correct usage type-checks cast-free,
> and assigning the view to a `number` is a type error.

## Preflight Gate

None.

## Task Summary Table

| #   | Title                                                                                              | Dependencies | Complexity |
| --- | -------------------------------------------------------------------------------------------------- | ------------ | ---------- |
| 1   | [Type the `inputs` bag per-descriptor](./1-externalseries-inputs-type.md)                          | None         | High       |

## Code Reuse / Lockstep

- **Value types come from `resolveInputs`, not guesswork.** The map must equal
  what `packages/runtime/src/inputs/resolveInputs.ts` writes to `out[key]` for
  each `descriptor.kind` — that type≡runtime equality is the entire point (the
  bug was type ≠ runtime). External-series already resolves to the slot's
  `Series<number>` view (`resolveInputs.ts:54`;
  `externalSeriesFeeds.ts:19-24`).
- **`Series<T>` already exists** (`packages/core/src/types.ts:159-163`,
  barrel-exported `index.ts:32`) — reuse it; do not redeclare.
- **Core ↔ compiler-shim lockstep.** The mapped type + generic threading land in
  BOTH `packages/core/src/` and the `CORE_AMBIENT_SHIM` in
  `packages/compiler/src/program.ts` (`ComputeContext` `:1546-1568`, the four
  `Define*Opts` + `define*` decls `:1592-1624`). They must stay structurally
  identical (per `packages/compiler/CLAUDE.md` "core resolves through an ambient
  shim").
- **All four constructors** (`defineIndicator`, `defineAlert`, `defineDrawing`,
  `defineAlertCondition`) share the single `ComputeFn`/`ComputeContext` and each
  carries `inputs?: InputSchema` — so all four get the generic in lockstep;
  typing only `defineIndicator` would leave alert/drawing scripts untyped.

## Related / Ordering

Independent of the in-flight external-series **runtime** fixes (slot-capacity
sizing + per-entry feed-guard tolerance) already on `main`; this type feature
can ride the same changesets "Version Packages" release.
