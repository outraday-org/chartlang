---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-runtime": minor
"chartlang-example-canvas2d-adapter": minor
"@invinite-org/chartlang-conformance": minor
---

Phase 3 Task 11 — Fibonacci A (`fibRetracement` / `fibTrendExtension`
/ `fibChannel` / `fibTimeZone` / `fibWedge`).

- **core** — `DrawNamespace` flattened: the four sub-namespace types
  (`FibSubNamespace`, `GannSubNamespace`, `ElliottSubNamespace`,
  `PatternSubNamespace`) are removed; every kind now lives as a flat
  method directly on `DrawNamespace` matching the canonical
  `STATEFUL_PRIMITIVES` names (`draw.fibRetracement(...)`,
  `draw.gannBox(...)`, `draw.elliottImpulseWave(...)`,
  `draw.xabcdPattern(...)`, etc.). The throwing-stub `draw` Proxy
  drops the sub-namespace branch. Script authors use the flat
  Pine/invinite-parity surface; the compiler resolves callsites
  through its existing 2-segment property-access path. The 30
  not-yet-ported method signatures (Tasks 12–18 fib-B / gann /
  pitchfork / pattern / elliott / cycle / container kinds) are
  declared as flat stubs so Tasks 12–18 only need to extend the
  runtime `KIND_IMPLS` map. **BREAKING** for any consumer that
  referenced `draw.fib.retracement(...)` or one of the four
  sub-namespace types — none currently exist outside Phase-3 work.
- **adapter-kit** — 5 new per-kind validators
  (`validateFibRetracementState`, `validateFibTrendExtensionState`,
  `validateFibChannelState`, `validateFibTimeZoneState`,
  `validateFibWedgeState`) + 1 file-local style helper
  (`validateFibOpts`) covering FibOpts (`levels` finite-array,
  `showLabels` / `color` / `extendLeft` / `extendRight`).
- **runtime** — 5 new emit functions under
  `packages/runtime/src/emit/draw/fibA/` wired into `DRAW_NAMESPACE`
  as flat methods. `fibRetracement` / `fibTimeZone` use the 4-arg
  form `(slotId, a, b, opts?)`; the other 3 use the 3-arg
  `(slotId, anchors, opts?)` form. No new sub-namespace wiring.
- **canvas2d-adapter** — 5 new renderers reusing Task-4's
  `FIB_LEVELS` + `formatLevel` and Task-5's `extendLineSegment` for
  the `fib-retracement` viewport extension. Default colour
  `"#facc15"` (warm yellow) per invinite's fib-tool palette.
- **conformance** — 6 new scenarios (5 per-kind + 1
  `drawFibA` bundle) with pinned `drawing-hash` assertions.
  Conformance + scenarios test-capability fixtures grow `other`
  bucket from 0 to 100 and add the 5 fib-A kebab kinds.

Divergences flagged in `tasks/phase-3-drawing-parity/11-fibonacci-a.plan.md`:

- `fib-time-zone` uses the canonical ratio array (`FIB_LEVELS`),
  NOT the integer Fibonacci sequence; `fibSequence.ts` helper is
  NOT created (Task-1 reshape follow-up).
- `fib-wedge` rays are drawn with a fixed length
  `max(pxWidth, pxHeight) * 2` rather than via a directional
  `extendLineSegment` variant.
- Per-kind property / golden test files deferred to the pragmatic
  1-file-per-emit + 1-file-per-renderer set, mirroring Tasks 5–10.

See `tasks/phase-3-drawing-parity/11-fibonacci-a.plan.md` for the
full audit + divergence list.
