---
"@invinite-org/chartlang-runtime": minor
---

Replace the Phase-0 placeholder with the Phase-1 runtime data
structures: `RingBuffer<T>` + `Float64RingBuffer` per PLAN.md §6.6,
`makeSeriesView` Proxy with stable identity across bars,
`createStreamState` (10-field OHLCV ring-buffer set + mutable `BarView`
+ cached `Series<number>` views + `taSlots` map), `StateStore`
interface + `inMemoryStateStore` default, and `RuntimeContext` +
`ACTIVE_RUNTIME_CONTEXT` slot. Add `@invinite-org/chartlang-core` and
`@invinite-org/chartlang-adapter-kit` as workspace dependencies and
`fast-check ^3.20.0` as a devDep (first consumer; Tasks 6-7 reuse).
The execution loop and primitives land in Tasks 6-8.
