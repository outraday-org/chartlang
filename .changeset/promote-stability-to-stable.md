---
"@invinite-org/chartlang-pine-converter": patch
"@invinite-org/chartlang-conformance": patch
"@invinite-org/chartlang-runtime": patch
---

Promote every remaining `@experimental` symbol to `@stable`. The entire
`pine-converter` public surface, the three `pineConverterRoundTrip*` conformance
scenarios, and `runtime/barPoint.ts` now carry the stable maturity marker.
Annotation-only — no behavior, API, or output changes; goldens and conformance
reports are byte-identical. The hand-authored `docs/converter/index.md`
stability line is updated to match.
