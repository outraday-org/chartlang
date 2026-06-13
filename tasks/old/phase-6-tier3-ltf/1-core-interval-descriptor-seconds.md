# Core: `IntervalDescriptor.intervalSeconds?` + `intervalToSeconds` helper

> **Status: TODO**

## Goal

Land the foundational interval-ordering primitives that the Phase 6
LTF stack depends on: widen `IntervalDescriptor` with the optional
`intervalSeconds?: number` override reserved by PLAN §4.9, and ship a
pure `intervalToSeconds(d: IntervalDescriptor): number` helper that
prefers the field when set and otherwise parses `d.value` against the
canonical prefix grammar. Every downstream Phase-6 task (LTF kernel,
`request.lowerTf` compiler validation, runtime wiring) consumes this
helper.

## Prerequisites

None — this task lands first in Phase 6. Phase 5 closeout shipped the
`IntervalDescriptor` shape that this task widens.

## Current Behavior

`packages/core/src/types.ts` declares `IntervalDescriptor` as
**three** required readonly fields:

```ts
export type IntervalDescriptor = {
  readonly value: string;
  readonly label: string;
  readonly group: string;
};
```

No `intervalSeconds` field. No `intervalToSeconds` helper anywhere in
core or runtime. Adapter authors who need to compare intervals roll
their own parsing (the canvas2d adapter and the conformance harness
both contain ad-hoc switch statements).

## Desired Behavior

`IntervalDescriptor` carries an **optional** `intervalSeconds?: number`
override. A new pure helper `intervalToSeconds(d): number` ships from
`@invinite-org/chartlang-core`:

- If `d.intervalSeconds` is set, return it (rounded, must be a
  positive finite number — otherwise throw).
- Otherwise parse `d.value` against the canonical prefix grammar
  (hour suffix accepts **both** `"H"` and `"h"` — the canvas2d
  reference adapter ships `"1h"` lowercase; case-insensitive
  matching avoids a behaviour-breaking rename in Phase 5 manifests):
  - `"<n>s"` → `n` (e.g. `"30s"` → 30)
  - `"<n>"` (no suffix) → `n * 60` (Pine-style "minutes")
  - `"<n>m"` → `n * 60`
  - `"<n>H"` or `"<n>h"` → `n * 3600`
  - `"<n>D"` → `n * 86400`
  - `"<n>W"` → `n * 604800`
  - `"<n>M"` → `n * 2_592_000` (30-day month — documented
    approximation; the helper's JSDoc spells this out)
  - `"<n>Y"` → `n * 31_536_000` (365-day year — same approximation
    note)
- Numeric prefix must parse as a positive integer; otherwise throw.
- Unknown suffix → throw with a clear error message including the
  offending value.

The helper is the single source of truth for interval ordering across
the workspace. The canvas2d adapter and conformance harness migrate
to it in this task (replacing their ad-hoc parsers).

## Requirements

### 1. Widen `IntervalDescriptor` in `packages/core/src/types.ts`

```ts
/**
 * Symbolic interval descriptor.
 *
 * The `value` field is the canonical short form ("1m", "5", "4H",
 * "1D", "30s"). The optional `intervalSeconds` override lets exotic
 * intervals (tick-based, range-based, custom) declare their effective
 * second count without extending the grammar — see PLAN §4.9.
 *
 * @since 0.1
 * @stable
 */
export type IntervalDescriptor = {
  readonly value: string;
  readonly label: string;
  readonly group: string;
  /**
   * Optional second-count override. When present, takes precedence
   * over parsing `value` for any ordering / conversion math. Must be
   * a positive finite number.
   *
   * @since 0.6
   * @stable
   */
  readonly intervalSeconds?: number;
};
```

The field is **optional** — every Phase-5 adapter (including
`canvas2d-adapter`) continues to compile and run without setting it.
The `tsc` strictness is preserved (`exactOptionalPropertyTypes: true`)
so adapters that omit the field have the symbol absent, not `undefined`.

### 2. New module `packages/core/src/interval/intervalToSeconds.ts`

```ts
import type { IntervalDescriptor } from "../types.js";

/**
 * Convert an `IntervalDescriptor` to its effective second count.
 *
 * Prefers `d.intervalSeconds` when present. Otherwise parses `d.value`
 * against the canonical prefix grammar:
 *
 * | Suffix    | Multiplier      | Example       |
 * |-----------|-----------------|---------------|
 * | `s`       | 1               | `"30s"` → 30  |
 * | (none)    | 60              | `"5"`   → 300 |
 * | `m`       | 60              | `"5m"`  → 300 |
 * | `H` / `h` | 3600            | `"4H"`  → 14400, `"1h"` → 3600 |
 * | `D`       | 86_400          | `"1D"`  → 86400 |
 * | `W`       | 604_800         | `"1W"`  → 604800 |
 * | `M`       | 2_592_000 *     | `"1M"`  → 2_592_000 |
 * | `Y`       | 31_536_000 *    | `"1Y"`  → 31_536_000 |
 *
 * `*` Month / year suffixes use 30- and 365-day approximations. For
 * exact calendar-aware math, adapters that need DST-correct durations
 * should set `intervalSeconds` explicitly.
 *
 * The hour suffix is case-insensitive to preserve compatibility with
 * Phase-5 adapter manifests that ship `"1h"` (lowercase).
 *
 * @throws Error when `intervalSeconds` is non-positive / non-finite,
 *   or when `value` doesn't match the grammar, or when the numeric
 *   prefix is non-positive.
 *
 * @example
 *   intervalToSeconds({ value: "1D", label: "1D", group: "daily" }); // 86400
 *   intervalToSeconds({ value: "x", label: "x", group: "x", intervalSeconds: 7 }); // 7
 *
 * @since 0.6
 * @stable
 */
export function intervalToSeconds(d: IntervalDescriptor): number {
  if (d.intervalSeconds !== undefined) {
    if (!Number.isFinite(d.intervalSeconds) || d.intervalSeconds <= 0) {
      throw new Error(
        `intervalToSeconds: intervalSeconds must be a positive finite number; received ${d.intervalSeconds}`,
      );
    }
    return d.intervalSeconds;
  }
  const v = d.value;
  const match = /^(\d+)([smHhDWMY]?)$/.exec(v);
  if (!match) {
    throw new Error(
      `intervalToSeconds: cannot parse interval value ${JSON.stringify(v)} — expected <n>{s|m|H|h|D|W|M|Y}? or set intervalSeconds`,
    );
  }
  const n = Number.parseInt(match[1]!, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(
      `intervalToSeconds: numeric prefix must be a positive integer; received ${JSON.stringify(v)}`,
    );
  }
  const suffix = match[2] ?? "";
  switch (suffix) {
    case "s":
      return n;
    case "":
    case "m":
      return n * 60;
    case "H":
    case "h":
      return n * 3600;
    case "D":
      return n * 86_400;
    case "W":
      return n * 604_800;
    case "M":
      return n * 2_592_000;
    case "Y":
      return n * 31_536_000;
    /* c8 ignore next 2 — regex narrowing keeps this unreachable */
    default:
      throw new Error(`intervalToSeconds: unreachable suffix ${suffix}`);
  }
}
```

### 3. Barrel re-export from `packages/core/src/index.ts`

Append a single line to the existing `index.ts`:

```ts
export { intervalToSeconds } from "./interval/intervalToSeconds.js";
```

The `IntervalDescriptor` widening is structural — no change to the
existing `export type` line.

### 4. `CORE_AMBIENT_SHIM` declaration

In `packages/compiler/src/program.ts`, append the function declaration
to the existing shim string so user scripts can call
`intervalToSeconds(...)` directly when needed:

```ts
declare function intervalToSeconds(d: IntervalDescriptor): number;
```

### 5. Tests

Co-locate with the implementation:

- `packages/core/src/interval/intervalToSeconds.test.ts` — unit cases:
  - Every suffix variant (`"30s"`, `"5"`, `"5m"`, `"4H"`, `"1h"`,
    `"1D"`, `"1W"`, `"1M"`, `"1Y"`).
  - `"1h"` and `"1H"` both return `3600` (case-insensitive hour).
  - `intervalSeconds` override beats parsing.
  - `intervalSeconds = 0` throws.
  - `intervalSeconds = -1` throws.
  - `intervalSeconds = NaN` throws.
  - `intervalSeconds = Infinity` throws.
  - `value = ""` throws.
  - `value = "abc"` throws.
  - `value = "0D"` throws (zero numeric prefix).
  - `value = "-5m"` throws (negative prefix).
  - `value = "5x"` throws (unknown suffix).
- `packages/core/src/interval/intervalToSeconds.property.test.ts` —
  fast-check property + pinned seed:
  - For every `n in [1, 1000]` and every valid suffix `s`, the helper
    returns `n * expectedMultiplier[s]`.
  - For every `n in [1, 1000]`, when `intervalSeconds = n`, the
    helper returns `n` regardless of `value`.

### 6. Migrate ad-hoc parsers

Audit the workspace for existing interval-string parsing and migrate
every callsite to `intervalToSeconds`. As of Phase 5 the workspace
ships **no** ad-hoc parsers — intervals are stored as static
`IntervalDescriptor` objects (see
`examples/canvas2d-adapter/src/capabilities.ts:13–20`,
`packages/runtime/src/request/alignHtfSeriesCache.ts` keys by literal
equality, no parsing). This step's audit confirms the absence; if a
parser slipped in via an unrelated PR, migrate it.

Audit locations:
- `examples/canvas2d-adapter/src/` — any switch on interval strings.
- `packages/conformance/src/` — any test-side parser.
- `packages/runtime/src/request/` — any Phase-5 ad-hoc helper.
- `packages/runtime/src/timeframe/` (if present).
- `packages/host-worker/src/`, `packages/host-quickjs/src/` — any
  host-side interval-comparison logic.

For every migrated site (if any), the diff is:
- Add an import of `intervalToSeconds`.
- Replace the inline switch / regex with a single call.
- Keep the call site behaviour identical (no semver-breaking change).

The audit result (clean / migrated) is captured in the PR description.

### 7. JSDoc gate

Every new export carries `@since 0.6`, `@stable`, and `@example`. The
`IntervalDescriptor.intervalSeconds` field carries `@since 0.6` +
`@stable` per the JSDoc gate.

### 8. README gate

`packages/core/README.md` stays ≤ 100 lines. The new helper is one
bullet in the existing "Surface" list — no new section.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/types.ts` | Modify | Add `intervalSeconds?: number` to `IntervalDescriptor`. |
| `packages/core/src/interval/intervalToSeconds.ts` | Create | Helper impl + JSDoc. |
| `packages/core/src/interval/intervalToSeconds.test.ts` | Create | Unit tests (every suffix + error cases). |
| `packages/core/src/interval/intervalToSeconds.property.test.ts` | Create | Property tests with pinned seed. |
| `packages/core/src/index.ts` | Modify | Append `intervalToSeconds` re-export. |
| `packages/compiler/src/program.ts` | Modify | Append `declare function intervalToSeconds(...)` to `CORE_AMBIENT_SHIM`. |
| `examples/canvas2d-adapter/src/**` | Modify | Replace ad-hoc parsers with `intervalToSeconds`. |
| `packages/conformance/src/**` | Modify | Replace ad-hoc parsers with `intervalToSeconds`. |
| `packages/runtime/src/**` | Modify (only if ad-hoc parsers exist) | Migrate to `intervalToSeconds`. |
| `packages/core/README.md` | Modify | One-line surface update. |
| `.changeset/phase6-interval-seconds.md` | Create | Minor bump on `@invinite-org/chartlang-core`, patch on consumers. |

## Gates

- `pnpm typecheck` — strict; `exactOptionalPropertyTypes` keeps the
  field absent unless explicitly set.
- `pnpm lint`.
- `pnpm test` — 100% coverage on `packages/core/src/interval/`.
- `pnpm docs:check` — auto-generates
  `docs/primitives/interval/intervalToSeconds.md` from the JSDoc.
- `pnpm readme:check`.

## Changeset

`.changeset/phase6-interval-seconds.md`:

```md
---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-conformance": patch
"@invinite-org/chartlang-canvas2d-adapter": patch
---

Add `IntervalDescriptor.intervalSeconds?: number` override and a
pure `intervalToSeconds(d)` helper. Foundational for Phase-6
lower-timeframe ordering checks. Existing adapters and scripts
continue to compile unchanged.
```

## Acceptance Criteria

- [ ] `IntervalDescriptor.intervalSeconds?: number` ships in
      `packages/core/src/types.ts` with JSDoc carrying `@since 0.6`
      and a stability marker.
- [ ] `intervalToSeconds` ships from
      `@invinite-org/chartlang-core` with full JSDoc and is re-exported
      from the package barrel.
- [ ] Unit tests cover every grammar branch + every error path.
- [ ] Property test (fast-check + pinned seed) passes for
      `n in [1, 1000]` across every suffix.
- [ ] 100% line / statement / branch / function coverage on
      `packages/core/src/interval/`.
- [ ] Every existing ad-hoc interval parser in the workspace migrates
      to `intervalToSeconds`; `grep`-search confirms no remaining
      inline switches on interval strings.
- [ ] `CORE_AMBIENT_SHIM` declares `intervalToSeconds`.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm docs:check`,
      `pnpm readme:check` all green.
- [ ] Changeset committed.
