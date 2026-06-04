---
"@invinite-org/chartlang-adapter-kit": minor
---

Replace the Phase-0 placeholder with the Phase-1 adapter contract:
`Adapter` / `Capabilities` / `CandleEvent` types and the §7.3 emission
shapes, capability builders (`capabilities.line()` / `.allLines()` /
`.alerts(...)` / `.union(...)`), `defineAdapter` factory, hand-rolled
`validateEmission` (no `zod` / `valibot` dependency) covering every
Phase-1 emission and meta walker, `decodeDrawing` Phase-1 stub,
`mockCandleSource` for test playback, and `PassThroughAdapter` /
`BufferingAdapter` base classes for runtime + conformance fixtures.
