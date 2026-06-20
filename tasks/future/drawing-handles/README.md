# Mutable drawing handles — design RFC (no implementation)

## Overview

Today `draw.*` is **declarative-per-bar**: a script re-issues every drawing
each `compute` step and the runtime emits a fresh `DrawingEmission`. Pine's
`line`/`label`/`box`/`polyline` are a different model — **create once, mutate
across bars** (`line.set_xy1`, `label.set_text`, `box.set_top`), with the
object persisting until explicitly deleted or aged out by a `max_*_count`
budget. That stateful-object model is the idiom for trailing stops, extending
anchored levels, live HUD labels, and "last N pivots" overlays.

This is a **major architectural fork**, not a primitive add — it touches the
slot lifecycle, the adapter contract (mutation vs re-emit), conformance, and
the converter. Per the decision to resolve the fork before committing build
effort, this folder ships **one design RFC task only**. No code, no impl tasks
— those are authored as a follow-up folder once the RFC's recommendation is
accepted.

## Current State

- `draw.*` (≈65 tools, `skills/chartlang-coding/references/primitives.md`) are
  declarative: each call emits a `DrawingEmission` for the current bar; nothing
  persists an addressable object across bars.
- `state.*` (`packages/core/src/state/`) provides the committed/tentative
  cross-bar slot lifecycle that a mutable object would need; `state.array` /
  `state.map` (`../state-array/`, `../map-collection/`) extend it to bounded
  collections — the natural substrate for a `max_lines_count`-style object
  budget.
- The adapter contract (`packages/adapter-kit/`) consumes per-bar emission
  arrays; there is no notion of "update drawing #7's endpoint."
- The anchored-line example (`tasks/old/anchored-line` / recent commit
  `6f7fc72 add anchored line example`) hints at the demand.

## Target State (of THIS folder)

- A single committed design document: `1-design-rfc.md` produces a written RFC
  (checked into `docs/rfcs/` or the repo's design-doc location) that a
  maintainer can accept/reject. It does **not** change any package.

## Architecture Questions the RFC Must Resolve

| Question | Why it's load-bearing |
|----------|------------------------|
| **Object identity & lifecycle** | How is a handle minted and kept stable across bars? Per-callsite slot id (like `state.*`) vs an explicit `draw.line.new()` returning a handle stored in a `state` slot. Determines snapshot/restore + tick-replay semantics. |
| **Mutation API surface** | `h.setXY1(...)` / `h.setText(...)` method handles vs a declarative "diff against last bar" reconciler. The former matches Pine; the latter keeps the adapter contract emission-only. |
| **Adapter contract impact** | Does the wire stay per-bar full-emission (adapter re-renders from a complete object set each bar) or gain incremental mutation messages? Full-set-per-bar is simpler + keeps existing adapters working; incremental is lighter for large object counts. |
| **Object budget / eviction** | Pine's `max_lines_count` / `max_labels_count` / `max_boxes_count`. Reuse the bounded `state.array`/`state.map` eviction (oldest-deleted) so the object set stays snapshot-clean. |
| **Deletion** | Explicit `h.delete()` vs auto-eviction vs "not re-issued this bar → removed." Interacts with the declarative-vs-stateful choice. |
| **Coexistence with declarative `draw.*`** | Do handles supersede, wrap, or sit beside today's `draw.*`? Recommend keeping declarative `draw.*` as the default and handles as an opt-in for the persist-and-mutate cases. |
| **Z-order interaction** | Handles must slot into the global render order from `../../plot-draw-z-order/` (`z`, group band, declaration order). The RFC states how a long-lived object's `z` is sourced. |
| **Converter mapping** | Pine `line.new`/`label.new`/`box.new` + their `set_*`/`delete` → the chosen chartlang shape. Feasibility note, not implementation. |
| **Sandbox / serialization** | Handles cross the host transferable boundary; the RFC confirms the object store is structurally cloneable (numbers/strings only), mirroring `state.map`'s key/value constraint. |

## Task Summary Table

| # | Title | Output | Dependencies | Est. Complexity |
|---|-------|--------|--------------|-----------------|
| 1 | [Author the drawing-handles RFC](./1-design-rfc.md) | Design doc (`docs/rfcs/`) | None | Medium |

## Code Reuse (to be evaluated by the RFC, not consumed here)

| Existing | Path | Relevance |
|----------|------|-----------|
| `state.*` slot lifecycle | `packages/core/src/state/` | Cross-bar persistence + snapshot/restore substrate. |
| `state.map` bounded keyed store | `../map-collection/` | Object set with budget eviction. |
| `DrawingEmission` + adapter contract | `packages/adapter-kit/` | The wire that either stays full-set or gains mutations. |
| Z-order render contract | `../../plot-draw-z-order/` | Global ordering a long-lived object must obey. |
| Anchored-line example | recent commit `6f7fc72` | Concrete motivating use case. |

## Provenance

N/A — design only.

## Deferred / Follow-Up Work

- **The implementation folder** (`future/drawing-handles-impl/` or similar):
  authored only after this RFC is accepted, with the usual core → runtime →
  adapter-kit → conformance → converter task split.
- Decision on whether `table` (already a `draw.table`) folds into the same
  handle model or stays declarative.
