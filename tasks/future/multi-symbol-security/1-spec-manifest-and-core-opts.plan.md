# Task 1 Plan — Spec + manifest `requestedFeeds` + core opts `symbol` + `feedKey`

## Context

Foundation task for the multi-symbol `request.security` batch. Pure contract
widening — no behavior change. Widen `RequestSecurityOpts` with optional
`symbol`, add additive `manifest.requestedFeeds: RequestedFeed[]` (keep
`requestedIntervals` as the main-symbol HTF projection; `apiVersion` stays 1),
add `symbol?` to `SecurityExpressionDescriptor`, and create the single shared
`feedKey(symbol, interval)` composite-key helper that Tasks 2–7 MUST consume
(never re-derive). Mirror everything in the compiler ambient shim in lockstep.

## Pre-existing work / validated references

- `RequestSecurityOpts` is `Readonly<{ interval: string }>` at
  `packages/core/src/request/request.ts:17`. Two `security` overloads at
  lines 129–130. `SecurityBar.symbol: Series<string>` already exists
  (line 64) — reuse, do not add. `RequestLowerTfOpts` (line 32) untouched.
- Primitive JSDoc block on `security` is lines 94–128 (two `@example`s).
- `SecurityExpressionDescriptor { slotId, interval, paramName }` at
  `packages/core/src/types.ts:419` (task said 396; actual is 419, example
  block 401–417).
- `ScriptManifest` at `types.ts:471`; `apiVersion: 1` (line 472);
  `requestedIntervals` (line 477); `securityExpressions?` (line 635, JSDoc
  619–634).
- Three-place export lockstep confirmed: `request/request.ts` (source),
  `request/index.ts` (barrel, lines 4–11), `src/index.ts` (root: types at
  221–227; `SecurityExpressionDescriptor` re-exported via `types.js` block
  line 29). `request` value exported root line 220.
- Compiler shim (`packages/compiler/src/program.ts`): `RequestSecurityOpts`
  at line 1066; `SecurityBar` 1068; `RequestNamespace` **interface** 1088–1092
  (KEEP interface — overload-collapse rule); `SecurityExpressionDescriptor`
  `Readonly<{…}>` at 1104–1108; `ScriptManifest` object type 1118–1144 with
  `requestedIntervals` (1124) + `securityExpressions?` (1140).
- `compile.test.ts` shim type-check test at lines 61–107 (expr + data form).
- Type tests: `request/request.types.test.ts:40` asserts
  `RequestSecurityOpts` **exactly equals** `Readonly<{ interval: string }>` —
  MUST update. `types.types.test.ts` covers `SecurityExpressionDescriptor`
  (248–252), `ScriptManifest.securityExpressions` (242–246).
- No `feedKey` / `requestedFeeds` / `RequestedFeed` symbol exists anywhere
  (grep clean) — safe to add.
- Interval regex `/^(\d+)([smhdwM])$/` at
  `apps/site/src/components/demo/secondaryStreams.ts:25` — confirms `@` cannot
  appear in an interval literal, so `"<symbol>@<interval>"` cannot collide
  with a bare-interval key.

## Issues found vs task text

- Task says `SecurityExpressionDescriptor` at line 396 → actually 419.
- Task says `ScriptManifest.requestedIntervals` at 454 / `apiVersion` at 449 →
  actually 477 / 472.
- Task says core is `1.1.1`; it is already `1.2.0` (the state-array changeset
  already bumped minor). `@since 1.2` is still correct (it's the shipping
  version). My changeset stacks another minor — fine, changesets accumulate.
- Task says interval regex at `secondaryStreams.ts:55` → actually line 25.
- `request/request.types.test.ts:40` uses `.toEqualTypeOf` (exact) — adding
  optional `symbol` breaks it; must switch to assert the widened shape.

## Steps

1. `request.ts` — widen `RequestSecurityOpts` with optional `symbol`
   (JSDoc per task §1). Update the `security` primitive JSDoc: add a
   different-symbol `@example` and note the `multiSymbol` gate, keeping both
   forms documented for `skills:generate`.
2. Create `request/feedKey.ts` — the `feedKey` helper (task §4 body) with the
   `@` / undefined-collapse rationale comment + MIT header + full JSDoc
   (`@since 1.2`, `@stable`, `@example`).
3. Create `request/feedKey.test.ts` — 100% coverage: `@` encoding, undefined
   collapse, empty-string collapse, distinctness round-trip, both branches.
4. `types.ts` — add `RequestedFeed` type next to
   `SecurityExpressionDescriptor`; add `requestedFeeds?` to `ScriptManifest`
   next to `securityExpressions?`; add `symbol?` to
   `SecurityExpressionDescriptor` + update its `@example` (keep symbol-omitted)
   and `securityExpressions?` `@example` (add one symbol-bearing entry).
5. `request/index.ts` — re-export `RequestedFeed` (type) + `feedKey` (value).
6. `src/index.ts` — re-export `feedKey` (value) + `RequestedFeed` (type, in the
   `types.js` type block).
7. `request/request.types.test.ts` — replace the exact-equality assertion with
   widened-shape assertions: optional `symbol` accepted, symbol-omitted
   accepted, symbol-bearing accepted; both overloads accept both.
8. `types.types.test.ts` — add assertions for `ScriptManifest.requestedFeeds`,
   `RequestedFeed` shape (`symbol?` / `interval`), and
   `SecurityExpressionDescriptor.symbol?`. Import the new type from root.
9. `program.ts` shim — widen `RequestSecurityOpts` with `readonly symbol?`,
   add `RequestedFeed` + `requestedFeeds?` to the shim `ScriptManifest`, add
   `symbol?` to the shim `SecurityExpressionDescriptor`. Keep `RequestNamespace`
   an interface.
10. `compile.test.ts` — extend the shim test to type-check a symbol-bearing
    call (`request.security({ symbol: "AMEX:SPY", interval: "1D" })`) and keep
    the symbol-omitted form green.
11. `packages/core/CLAUDE.md` — note the `feedKey` format contract, the
    `requestedFeeds` superset / `requestedIntervals` projection relationship,
    and `RequestedFeed` joining the three-place export lockstep.
12. Create `.changeset/multi-symbol-security.md` (task §7 body).

## Files

| File | Action |
|------|--------|
| `packages/core/src/request/request.ts` | Modify — opts `symbol?`, JSDoc |
| `packages/core/src/request/feedKey.ts` | Create — helper |
| `packages/core/src/request/feedKey.test.ts` | Create — 100% cov |
| `packages/core/src/types.ts` | Modify — `RequestedFeed`, `requestedFeeds?`, `SecurityExpressionDescriptor.symbol?` |
| `packages/core/src/request/index.ts` | Modify — re-export |
| `packages/core/src/index.ts` | Modify — re-export |
| `packages/core/src/request/request.types.test.ts` | Modify |
| `packages/core/src/types.types.test.ts` | Modify |
| `packages/compiler/src/program.ts` | Modify — shim lockstep |
| `packages/compiler/src/compile.test.ts` | Modify — symbol-bearing type-check |
| `packages/core/CLAUDE.md` | Modify — invariants |
| `.changeset/multi-symbol-security.md` | Create — feature changeset |

## Gates to keep green

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-core test` (100% coverage incl. feedKey)
- `pnpm -F @invinite-org/chartlang-compiler test`
- `pnpm docs:check`

## Changeset

`.changeset/multi-symbol-security.md` — **minor** for core, compiler, runtime,
adapter-kit, host-worker, host-quickjs, pine-converter.

## Acceptance criteria

- `RequestSecurityOpts.symbol` optional; both overloads accept it; omitted
  still type-checks.
- `RequestedFeed` + `requestedFeeds?` + `SecurityExpressionDescriptor.symbol?`
  with full JSDoc; `apiVersion` unchanged.
- `feedKey` exported from all three places; `feedKey(undefined, "1D") === "1D"`,
  `feedKey("X", "1D") === "X@1D"`, `feedKey("", "1D") === "1D"`; 100% covered.
- Shim mirrors core; `RequestNamespace` stays interface; `compile()` test green
  for symbol-bearing + symbol-omitted.
- Changeset committed; `packages/core/CLAUDE.md` updated.
