---
"@invinite-org/create-chartlang": patch
---

Add the `webgl` seam template so `npm create @invinite-org/chartlang` can
vendor + rewrite the active-adapter seam for the new zero-dependency raw
WebGL2 example adapter (`chartlang-example-webgl-adapter`). `SEAM_IDS` now
carries six bundled ids (`canvas2d`, `lightweight-charts`, `uplot`,
`echarts`, `konva`, `webgl`); the new template body is byte-identical to the
matrix-proven `apps/react-starter` seam SSOT after the example-adapter →
vendored-local name substitution (`seamTemplates.test.ts` parity green).
