---
"@invinite-org/chartlang-pine-converter": patch
---

Lower Pine `fill(hline, hline)` / `fill(plot, plot)` to `draw.fillBetween`.
Both the static `linefill.new` lowering and the new `fill` lowering now route
through one shared `emitFillBetweenBand` edge-builder over pre-resolved edge
descriptors (constant-price hline / per-bar plot series / line endpoints); the
linefill output is byte-identical. The `fill` handles resolve to their defining
top-level (or inline) `hline`/`plot` calls and the fill colour folds via the
shared T6 colour rule. `fill-not-mapped` is narrowed to the deferred gradient /
`fillgaps` forms (message updated), and a new `fill-handle-unresolved` (error)
covers a handle that resolves to neither an `hline` nor a `plot` — `fill` is
never silently dropped. Adds the `fill-hline-band` / `fill-plot-band` (clean,
compile round-trip) and `fill-reject` fixtures, and documents the mapping in
the converter `supported.md` / `rejects.md`.
