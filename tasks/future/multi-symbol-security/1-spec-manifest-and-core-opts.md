# Task 1 — Spec + manifest `requestedFeeds` + core opts `symbol` + `feedKey`

> **Status: TODO**

## Goal

Land the **contract**: add the optional `symbol` field to
`RequestSecurityOpts`, add the additive `manifest.requestedFeeds:
{symbol?, interval}[]` field to `ScriptManifest`, add an optional `symbol?`
to `SecurityExpressionDescriptor`, define the single shared
`feedKey(symbol, interval)` composite-key helper, mirror every new shape in
the compiler ambient shim (`program.ts`) in lockstep, and create the feature
changeset. No behavior change yet — this task only widens the types and the
manifest so Tasks 2–5 have a contract to fill.

## Prerequisites

None.

## Current Behavior

- `RequestSecurityOpts` (`packages/core/src/request/request.ts:17`) is
  `Readonly<{ interval: string }>` — no `symbol`. The two `security`
  overloads (line 129) take it. `SecurityBar.symbol` (line 64) is already a
  `Series<string>`.
- `ScriptManifest.requestedIntervals: ReadonlyArray<string>`
  (`packages/core/src/types.ts:454`); `apiVersion: 1` (line 449).
- `SecurityExpressionDescriptor { slotId, interval, paramName }`
  (`packages/core/src/types.ts:396`); `securityExpressions?` (line 612).
- `RequestSecurityOpts` / `SecurityBar` / `SecurityExpr` are exported from
  three places in lockstep (`request/request.ts`, `request/index.ts`,
  `src/index.ts`) per `packages/core/CLAUDE.md`.
- `packages/compiler/src/program.ts` ambient shim declares
  `RequestSecurityOpts`, `SecurityBar`, the `RequestNamespace` **interface**
  (two `security` overloads), and `ScriptManifest`/
  `SecurityExpressionDescriptor`-shaped types in lockstep with core.
- There is **no** composite-key helper today; the runtime keys everything by
  the bare `interval` string.

## Desired Behavior

- `request.security({ symbol: "AMEX:SPY", interval: "1D" })` and
  `request.security({ interval: "1D" })` (symbol omitted) both type-check;
  both overloads accept the widened opts.
- `ScriptManifest.requestedFeeds?: ReadonlyArray<RequestedFeed>` exists,
  where `RequestedFeed = { symbol?: string; interval: string }`. Omitted on
  scripts with no `request.security` (snapshot byte-compat).
- `SecurityExpressionDescriptor` carries an optional `symbol?: string`
  (omitted ⇒ chart symbol).
- `feedKey(symbol: string | undefined, interval: string): string` is exported
  from core and is the **single** source of the composite-key format. It is
  pure, deterministic, and produces a byte-identical string for a given
  `(symbol, interval)` — including a stable encoding for the
  symbol-omitted (chart-symbol) case.
- The compiler shim mirrors all of it (lockstep); `compile()` type-checks the
  symbol-bearing call through the shim's two overloads.

## Requirements

### 1. Widen `RequestSecurityOpts` (`packages/core/src/request/request.ts`)

Add an **optional** `symbol`:

```ts
export type RequestSecurityOpts = Readonly<{
    /**
     * The instrument to read. Omit for the chart's own symbol (the existing
     * behavior). Must be a compile-time literal — a string literal, an
     * `input.symbol` default, or an `input.enum` value; the compiler's
     * literal-only pass rejects a dynamic expression with
     * `request-security-symbol-not-literal`. A non-chart symbol additionally
     * requires `Capabilities.multiSymbol`; otherwise the series degrades to
     * all-NaN.
     *
     * @since 1.2
     */
    readonly symbol?: string;
    readonly interval: string;
}>;
```

Update the `request.security` primitive JSDoc block (the one on the `security`
declaration, line ~94–128) to document the symbol form in **both**
`@example`s (so `pnpm skills:generate` captures it) — add a different-symbol
example and note the `multiSymbol` gate. Do **not** change the overload
signatures themselves (they already take `RequestSecurityOpts`).

`RequestLowerTfOpts` is unchanged (lowerTf stays chart-symbol-only — see
README Deferred).

### 2. `RequestedFeed` type + `requestedFeeds` manifest field (`packages/core/src/types.ts`)

Add the descriptor type next to `SecurityExpressionDescriptor`:

```ts
/**
 * One requested secondary feed — a `(symbol, interval)` pair the script's
 * `request.security` calls ask for. `symbol` omitted ⇒ the chart's own
 * symbol (the higher-timeframe-only case). The compiler emits one entry per
 * **distinct** feed; the runtime creates one secondary `StreamState` per
 * entry, keyed by the shared `feedKey(symbol, interval)` composite.
 *
 * @since 1.2
 * @stable
 * @example
 *     const f: RequestedFeed = { symbol: "AMEX:SPY", interval: "1D" };
 *     void f;
 */
export type RequestedFeed = {
    readonly symbol?: string;
    readonly interval: string;
};
```

Add the additive field to `ScriptManifest` (next to `securityExpressions?`):

```ts
/**
 * Every distinct secondary feed the script's `request.security` calls
 * request, as `(symbol?, interval)` pairs. Superset of
 * {@link ScriptManifest.requestedIntervals}, which stays the **main-symbol**
 * HTF projection (symbol-omitted feeds) for back-compat — adding this field
 * is additive within `apiVersion: 1`, whereas reshaping `requestedIntervals`
 * would not be. Absent on scripts with no `request.security` so existing
 * manifest snapshots stay byte-identical.
 *
 * @since 1.2
 * @stable
 * @example
 *     const v: ScriptManifest["requestedFeeds"] = [
 *         { interval: "1W" },
 *         { symbol: "AMEX:SPY", interval: "1D" },
 *     ];
 *     void v;
 */
readonly requestedFeeds?: ReadonlyArray<RequestedFeed>;
```

`requestedIntervals` keeps its type and meaning — do **not** change it.

### 3. Optional `symbol?` on `SecurityExpressionDescriptor` (`packages/core/src/types.ts`)

```ts
export type SecurityExpressionDescriptor = {
    readonly slotId: string;
    /** Requested symbol; omitted ⇒ chart symbol. @since 1.2 */
    readonly symbol?: string;
    readonly interval: string;
    readonly paramName: string;
};
```

Update the descriptor's `@example` to keep a symbol-omitted entry (so it
documents the back-compat case) and the manifest `securityExpressions?`
`@example` to show one symbol-bearing entry.

### 4. `feedKey` composite-key helper (`packages/core/src/request/feedKey.ts`, new)

The single source of the composite-key format — the byte-for-byte string the
runtime keys on and the host's `CandleEvent.streamKey` carries.

```ts
/**
 * Build the composite secondary-feed key from a `(symbol, interval)` pair —
 * the **single** source of the stream-key format shared by the runtime's
 * stream/cache maps and the host wire (`CandleEvent.streamKey`). Like a slot
 * id, this string is load-bearing: producer (adapter/host) and consumer
 * (runtime) must agree byte-for-byte, so never re-derive it inline.
 *
 * An **omitted** symbol (the chart's own symbol / higher-timeframe-only case)
 * encodes to the bare interval — `feedKey(undefined, "1D") === "1D"` — so the
 * symbol-omitted wire and every key stay byte-identical to the pre-multi-symbol
 * baseline. A present symbol encodes as `"<symbol>@<interval>"`.
 *
 * @since 1.2
 * @stable
 * @example
 *     feedKey(undefined, "1D"); // "1D"  (chart symbol, back-compat)
 *     feedKey("AMEX:SPY", "1D"); // "AMEX:SPY@1D"
 */
export function feedKey(symbol: string | undefined, interval: string): string {
    return symbol === undefined || symbol === "" ? interval : `${symbol}@${interval}`;
}
```

Rationale for the encoding (document in code comment): the `@` separator is
not a valid character in a chartlang interval literal (`/^\d+[smhdwM]$/`,
`apps/site/src/components/demo/secondaryStreams.ts:55`), so it cannot collide
with a bare-interval (chart-symbol) key; and the empty/undefined symbol
collapsing to the bare interval is what gives the omitted-symbol path
byte-identical keys/wire to today.

Export `feedKey` from the request barrel (`request/index.ts`) and the package
root (`src/index.ts`) alongside `RequestSecurityOpts`. Co-locate
`feedKey.test.ts` (`@` encoding, undefined/empty collapse to bare interval,
round-trip distinctness) — this file carries real logic so it needs 100%
coverage (not excluded like `types.ts`).

### 5. Three-place export lockstep (`packages/core/CLAUDE.md` invariant)

Export the new types from all three places in lockstep:

- `request/request.ts` (source of `RequestSecurityOpts`),
- `request/index.ts` (barrel) — `RequestedFeed`, `feedKey`,
- `src/index.ts` (package root) — `RequestedFeed`, `feedKey`.

`SecurityExpressionDescriptor` / `requestedFeeds` ride `types.ts` and its
existing root re-export.

### 6. Compiler ambient shim (`packages/compiler/src/program.ts`)

Mirror in the `declare module` block, byte-consistent with core:

- Widen the shim's `RequestSecurityOpts` with `readonly symbol?: string;`.
- Add `RequestedFeed` + `requestedFeeds?` to the shim's `ScriptManifest`-shaped
  declaration and `symbol?` to `SecurityExpressionDescriptor` (if the shim
  declares these manifest types; if it only declares the script-facing
  surface, only the opts widening is required — confirm by reading the shim).
- Keep `RequestNamespace` an **`interface`** (not `Readonly<{…}>`) so both
  `security` overloads survive (`packages/compiler/CLAUDE.md` overloaded-shim
  rule). Do not collapse the overloads.

### 7. Changeset (`.changeset/<slug>.md`)

Feature changeset for the whole work:

```md
---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-host-worker": minor
"@invinite-org/chartlang-host-quickjs": minor
"@invinite-org/chartlang-pine-converter": minor
---

Add multi-symbol support to `request.security`. `request.security({ symbol,
interval })` now reads a **different instrument** (not just a higher
timeframe), e.g. `request.security({ symbol: "AMEX:SPY", interval: "1D" })`.
`symbol` is optional (defaults to the chart symbol) and must be a compile-time
literal (`input.symbol` / `input.enum` resolved). A new `multiSymbol` adapter
capability gates non-chart-symbol requests; non-supporting adapters degrade to
NaN. The Pine converter now lowers `request.security("OTHER", tf, expr)`.
```

(Subsequent tasks append packages as needed; `host-*` / `adapter-kit` listed
here because Tasks 4–5 touch their `src/`.)

## Edge cases

- `symbol: ""` (empty string) must encode identically to omitted (chart
  symbol) — assert in `feedKey.test.ts`. The compiler likewise treats an
  empty/omitted symbol as the chart symbol.
- `requestedFeeds` and `requestedIntervals` can both reference the same
  symbol-omitted interval — that is expected (the feed is the superset; the
  interval list is the main-symbol projection). They are not mutually
  exclusive.
- Use `@since 1.2` on every new core surface (`symbol` field, `RequestedFeed`,
  `requestedFeeds`, `feedKey`, `SecurityExpressionDescriptor.symbol`).
  `@invinite-org/chartlang-core` is currently `1.1.1`; this changeset bumps it
  minor.
- Do **not** add a `symbol` to `RequestLowerTfOpts` (deferred).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/request/request.ts` | Modify | Add optional `symbol` to `RequestSecurityOpts`; update primitive JSDoc examples. |
| `packages/core/src/request/feedKey.ts` | Create | `feedKey(symbol, interval)` composite-key helper. |
| `packages/core/src/request/feedKey.test.ts` | Create | 100% coverage of the key format. |
| `packages/core/src/types.ts` | Modify | Add `RequestedFeed`, `requestedFeeds?`, `SecurityExpressionDescriptor.symbol?`. |
| `packages/core/src/request/index.ts` | Modify | Re-export `RequestedFeed`, `feedKey`. |
| `packages/core/src/index.ts` | Modify | Re-export `RequestedFeed`, `feedKey`. |
| `packages/core/src/request/request.types.test.ts` | Modify | `symbol` optional + omitted both type-check. |
| `packages/core/src/types.types.test.ts` | Modify | Root-export resolution of new types. |
| `packages/compiler/src/program.ts` | Modify | Mirror widened opts + manifest types in the shim. |
| `packages/compiler/src/compile.test.ts` | Modify | `compile()` type-checks symbol-bearing + symbol-omitted overloads. |
| `.changeset/<slug>.md` | Create | Feature changeset. |
| `packages/core/CLAUDE.md` | Modify | Note `requestedFeeds` superset / `requestedIntervals` projection; `feedKey` as the single key-format source; `RequestedFeed` joins the three-place export lockstep. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-core test` (100% coverage — `feedKey`
  branches all covered; sentinel-hole throws still asserted)
- `pnpm -F @invinite-org/chartlang-compiler test`
- `pnpm docs:check` (JSDoc on new exports: `@since 1.2`, `@example`,
  `@stable`)

## Changeset

`.changeset/<slug>.md` — **minor** (core, compiler, runtime, adapter-kit,
host-worker, host-quickjs, pine-converter). Created here; later tasks append
no new package (all listed up front).

## Acceptance Criteria

- `RequestSecurityOpts.symbol` optional; both overloads accept it; symbol
  omitted still type-checks (back-compat).
- `RequestedFeed` + `ScriptManifest.requestedFeeds?` +
  `SecurityExpressionDescriptor.symbol?` defined with full JSDoc; `apiVersion`
  unchanged.
- `feedKey` exported from all three places; `feedKey(undefined, "1D") === "1D"`
  and `feedKey("X", "1D") === "X@1D"`; 100% covered.
- Shim mirrors core (lockstep); `RequestNamespace` stays an `interface`;
  `compile()` test green for both symbol-bearing and symbol-omitted forms.
- Changeset committed; typecheck/lint/core+compiler tests/docs:check green;
  `packages/core/CLAUDE.md` updated.
