---
"@invinite-org/chartlang-pine-converter": minor
---

Land the codegen back end (`src/codegen/`) and wire the full conversion pipeline into the public `convert()`. `convert(pineSource)` now returns a real chartlang `.chart.ts` source string instead of throwing `ConverterNotReadyError`: it lexes, parses, runs the semantic analysis, drives the eight transform passes (declaration, inputs, the Camp A/B/C drawing lowerings, tables, polyline/linefill, control-flow), then emits the assembled `ScriptScaffold` IR through `emit(scaffold)`.

`emit` is a deterministic, pure-templating string emitter: an auto-generated header, a minimized `@invinite-org/chartlang-core` import (only the surfaces the body references, plus `type DrawingHandle` when handles are used), and the `export default defineIndicator/defineDrawing({ … })` block with its options + `compute` body. The converter OWNS the drawing-handle helper definitions (`useDrawingHandleSlot`, `useDrawingHandleRing`) and the state/handle/ring allocations, all emitted INSIDE `compute` where `draw`/`state` are in scope — the emitted source compiles cleanly through `@invinite-org/chartlang-compiler` (verified by a round-trip smoke test). Adds `scaffoldToManifest` for the `ConvertManifest`, the `codegen-output-invalid` diagnostic code, and `@invinite-org/chartlang-compiler` as a workspace dependency.
