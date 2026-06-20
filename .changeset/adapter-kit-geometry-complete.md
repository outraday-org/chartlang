---
"@invinite-org/chartlang-adapter-kit": minor
---

Complete the `adapter-kit` geometry layer with the final 23 drawing-kind
decomposers — 4 gann (`gann-box`, `gann-square-fixed`, `gann-square`,
`gann-fan`), 2 pitchforks (`pitchfork`, `pitchfan`), 6 harmonic patterns
(`xabcd-pattern`, `cypher-pattern`, `head-and-shoulders`, `abcd-pattern`,
`triangle-pattern`, `three-drives-pattern`), 5 elliott waves
(`elliott-impulse-wave`, `elliott-correction-wave`, `elliott-triangle-wave`,
`elliott-double-combo`, `elliott-triple-combo`), 3 cycles (`cyclic-lines`,
`time-cycles`, `sine-line`), and 3 containers (`group`, `frame`, `table`).

`decomposeDrawing` is now **exhaustive over all 63 `DrawingKind`s**: its
`default` arm is a `const _exhaustive: never` guard, so adding a future kind to
core fails `pnpm typecheck` until a decomposer is added. The `table` kind
decomposes in CSS-pixel/viewport space (it resolves `position` against the
`Viewport` rather than world coordinates).

Move the shared `gannLevels` (`GANN_LEVELS` / `GANN_FAN_RATIOS` /
`GANN_FAN_LABELS` / `formatGannRatio`) and `pitchforkGeom`
(`medianOriginFor` / `medianTargetFor`) helpers into package-private
`geometry/_lib/`, reused by the gann and pitchfork decomposers.
