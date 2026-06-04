# Series and indexing

> **Phase:** Lands in Phase 1.
> **Cross-reference:** See PLAN.md §4.3.

How `Series<T>` works in chartlang: zero-indexed historical access
(`series[0]` is the current bar, `series[1]` is the prior bar), NaN
warmup semantics, the no-unbounded-growth rule, the per-bar
synchronisation contract, and the runtime guarantees that let math
ports stay deterministic across hosts.

Stubbed during the Phase 0 bootstrap so the docs gate has a stable
target. Content lands with the Phase 1 runtime PR.
