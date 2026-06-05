---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": patch
"@invinite-org/chartlang-runtime": patch
---

Phase 2 quality-pass fixes (cross-cutting).

- `@invinite-org/chartlang-core`: new `STATEFUL_PRIMITIVES_BY_NAME`
  export — a `ReadonlyMap<string, StatefulPrimitiveEntry>` derived
  from the same canonical entry list as `STATEFUL_PRIMITIVES`. Lets
  the compiler look up entries by callee name in O(1) instead of an
  O(n) scan over the 93-entry set on every visited call site.
- `@invinite-org/chartlang-compiler`: `callsiteIdInjection` and
  `statefulCallInLoop` now consume `STATEFUL_PRIMITIVES_BY_NAME`
  via a `statefulByName: ReadonlyMap<string, StatefulPrimitiveEntry>`
  parameter (was `statefulSet: ReadonlySet<StatefulPrimitiveEntry>`).
  Internal-only API change — neither pass is publicly exported from
  `packages/compiler/src/index.ts`. The per-pass `hasName` /
  `findEntry` helpers are dropped.
- `@invinite-org/chartlang-runtime`: `ta/lib/maTypes.ts` re-exports
  `MaTypeNoVolume` from `@invinite-org/chartlang-core` instead of
  re-declaring it locally — keeps the two definitions from drifting
  when a 6th MA kind is added. `MaType` (which adds `"vwma"`) stays
  local since core has no equivalent. `__fixtures__/syntheticBars.ts`
  and `nanTick.test.ts`'s inline `Bar` literals now carry the
  `hl2` / `hlc3` / `ohlc4` / `hlcc4` fields the Phase-2 `Bar`
  extension made required (the per-package tsconfig had been hiding
  the typecheck miss).

Also: `examples/canvas2d-adapter` — extracted the duplicated
`dashPattern(LineStyle)` from `render/area.ts` + `render/horizontalLine.ts`
into `render/lineDash.ts`, re-exported from `render/index.ts`. No
behaviour change.
