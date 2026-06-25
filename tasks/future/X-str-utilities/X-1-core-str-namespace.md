# Task 1 — Core `str` namespace + deterministic formatter + ambient shim

> **Status: TODO**

## Goal

Introduce a pure, frozen `str` namespace in core (string + number-format
helpers), implemented with a host-independent fixed/precision formatter (no
`Intl`, no locale), export it from the core barrel, mirror it in the compiler
ambient script shim, and land unit + property tests + the feature changeset.

## Prerequisites

None.

## Current Behavior

- No `str` namespace exists in `packages/core/src`.
- The `color` namespace (`packages/core/src/color/index.ts:20`) is the
  reference shape for a pure frozen namespace: helpers live in a sibling file
  (`colorHelpers.ts`), `index.ts` re-exports them and freezes the namespace,
  the core barrel re-exports it (`packages/core/src/index.ts:229`), and the
  compiler ambient shim mirrors the surface
  (`packages/compiler/src/program.ts:891-915`).

## Desired Behavior

```ts
str.tostring(3.14159, "#.##")   // "3.14"
str.tostring(1234.5, "0.0000")  // "1234.5000"
str.tostring(42)                // "42"
str.format("{0} / {1}", a, b)   // positional
str.format("p={0,number,#.##}", price)
str.length("abc")               // 3
str.contains("abcdef", "cd")    // true
str.replace("a.b.c", ".", "-")  // "a-b.c" (first only)
str.replaceAll("a.b.c", ".", "-") // "a-b-c"
str.split("a,b,c", ",")         // ["a","b","c"]
str.upper("ab") / str.lower("AB") / str.trim(" x ") / str.repeat("-", 3)
str.startsWith / str.endsWith / str.substring(s, start, end?)
```

## Requirements

### 1. Formatter helpers (`packages/core/src/str/strHelpers.ts`, new)

Two-line MIT header (copy from `color/colorHelpers.ts`). Implement a
**deterministic** number formatter — no `toLocaleString`, no `Intl`:

- `formatNumber(value: number, mask?: string): string`
  - No mask → `String(value)` but with `NaN`/`Infinity` → `"NaN"`/`"∞"` per
    Pine (`-Infinity` → `"-∞"`).
  - Mask `"#.##"` (max N fractional digits, trailing zeros trimmed) vs
    `"0.0000"` (exactly N fractional digits, zero-padded). Detect by whether
    the fractional run uses `0` (fixed) or `#` (trimmed).
  - Implement via `value.toFixed(n)` then trim per the mask. `toFixed` is in
    `lib.es2022` and is host-deterministic for finite doubles.
  - Negative zero normalizes to `"0"` (no `"-0"`).
- `applyFormat(template: string, args: ReadonlyArray<string | number>): string`
  - Replace `{n}` with `String(args[n])`; `{n,number,MASK}` with
    `formatNumber(args[n] as number, MASK)`. Unmatched index → literal
    placeholder left intact (Pine leaves it). `{{`/`}}` are literal braces.

Each exported helper carries `@since 1.2`, `@stable`, `@example`.

### 2. `str` namespace (`packages/core/src/str/index.ts`, new)

Frozen object (mirror `color/index.ts:20`):

```ts
export const str = Object.freeze({
    tostring: (value: number | boolean | string, format?: string): string =>
        typeof value === "number" ? formatNumber(value, format) : String(value),
    format: (template: string, ...args: ReadonlyArray<string | number>): string =>
        applyFormat(template, args),
    length: (s: string): number => s.length,
    contains: (s: string, sub: string): boolean => s.includes(sub),
    startsWith: (s: string, sub: string): boolean => s.startsWith(sub),
    endsWith: (s: string, sub: string): boolean => s.endsWith(sub),
    replace: (s: string, target: string, repl: string): string => s.replace(target, repl),
    replaceAll: (s: string, target: string, repl: string): string => s.split(target).join(repl),
    split: (s: string, sep: string): ReadonlyArray<string> => s.split(sep),
    substring: (s: string, start: number, end?: number): string => s.substring(start, end),
    upper: (s: string): string => s.toUpperCase(),
    lower: (s: string): string => s.toLowerCase(),
    trim: (s: string): string => s.trim(),
    repeat: (s: string, count: number): string => s.repeat(Math.max(0, Math.trunc(count))),
});

export type StrNamespace = typeof str;
```

> `replace` uses the **string** overload (first occurrence) — never a `RegExp`
> (avoids ReDoS surface and keeps determinism). `repeat` guards negative /
> fractional counts (`String.repeat` throws on those).

The namespace-level `str` object carries `@since 1.2`, `@stable`, `@example`.

### 3. Barrel export (`packages/core/src/index.ts`)

Add next to the `color` export (line ~229):

```ts
export { str } from "./str/index.js";
export type { StrNamespace } from "./str/index.js";
```

### 4. Compiler ambient shim (`packages/compiler/src/program.ts`)

Mirror the surface as an ambient `export const str: Readonly<{ … }>` block
immediately after the `color` block (~line 915). Signatures must match core
exactly (the shim carries **no** implementation — same convention as the
`color`/`runtime` blocks). Keep `StrNamespace` out of the shim unless core
re-exports a value of it (types only as needed). Update the shim's leading
comment inventory if it enumerates namespaces.

### 5. Tests (co-located)

- **Unit** (`packages/core/src/str/index.test.ts`): every method incl. edge
  cases — `tostring(NaN)`, `tostring(-0)`, `"#.##"` vs `"0.0000"`, negative
  numbers, `format` with `{{`/`}}` and out-of-range index, `repeat(s, -1)`,
  `split` on empty separator, `substring` past end.
- **Property** (`packages/core/src/str/strHelpers.property.test.ts`): for
  random finite doubles, `formatNumber(x, "0.4")` round-trips through
  `Number(...)` within `5e-5`; `applyFormat` with all-distinct args never
  drops a provided arg. Use the repo's existing property runner (match the
  import style used by an existing `*.property.test.ts`).

### 6. Changeset

`.changeset/str-namespace.md` — `"@invinite-org/chartlang-core": minor` and
`"@invinite-org/chartlang-compiler": minor` (the ambient shim is a
script-visible surface add). One-paragraph summary.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/str/strHelpers.ts` | Create | Deterministic `formatNumber` + `applyFormat`. |
| `packages/core/src/str/index.ts` | Create | Frozen `str` namespace + `StrNamespace`. |
| `packages/core/src/str/index.test.ts` | Create | Unit tests. |
| `packages/core/src/str/strHelpers.property.test.ts` | Create | Property tests. |
| `packages/core/src/index.ts` | Modify | Barrel export `str` + type. |
| `packages/compiler/src/program.ts` | Modify | Ambient shim `str` block. |
| `.changeset/str-namespace.md` | Create | minor bump (core + compiler). |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (coverage 100% on core + compiler)
- `pnpm docs:check` (JSDoc on every new export)

## Changeset

`.changeset/str-namespace.md` — **minor** (core, compiler).

## Acceptance Criteria

- `str.*` type-checks inside a `compute` body both via the core types and via
  the compiler ambient shim (add a compile fixture asserting `str.tostring`
  usage compiles clean).
- Formatter is host-independent: no `Intl` / `toLocaleString` reference (grep
  clean), outputs identical under worker + quickjs.
- Unit + property layers landed; 100% coverage on `packages/core/src/str/`.
- JSDoc gate green (`@since`/`@stable`/`@example` on every export).
- Changeset committed.
