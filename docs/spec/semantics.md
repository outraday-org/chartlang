# Execution semantics

> **Phase:** Lands in Phase 1, expanded each phase.
> **Cross-reference:** See PLAN.md §6 / §17.3.

The execution model of a chartlang script: the per-bar `compute`
contract, NaN warmup semantics, the `Series<T>` indexing rules,
deterministic-ordering guarantees, state persistence across bars,
multi-stream alignment, and the no-unbounded-growth invariant.
Part of the canonical language spec.

Stubbed during the Phase 0 bootstrap so the docs gate has a stable
target. Content lands with the Phase 1 runtime PR and expands as
later phases add multi-stream + state primitives.
