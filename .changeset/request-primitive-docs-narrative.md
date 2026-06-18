---
"@invinite-org/chartlang-core": patch
"@invinite-org/chartlang-cli": patch
---

Expand the `request.security` / `request.lowerTf` JSDoc into narrative
descriptions with realistic examples (higher-timeframe `SecurityBar` reads
and lower-timeframe contained-bar arrays), and cross-link both generated
primitive pages to the multi-timeframe guide via their `seeAlso` entry in
`genPhase4Docs.ts`. The auto-generated `docs/primitives/request/*.md` pages
and the hover registry were regenerated from the new JSDoc — no runtime
behaviour change.
