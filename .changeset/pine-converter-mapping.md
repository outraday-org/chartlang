---
"@invinite-org/chartlang-pine-converter": patch
---

Add the declarative Pine v6 → chartlang mapping tables under
`src/mapping/`: drawing constructors + setters, style enums, `input.*`
primitives, and `ta.*` / `math.*` passthrough. Each table is an immutable
lookup with a `chartlang: null` REJECT marker and a shared `lookup` helper
that collapses missing keys and REJECTs to `null`. Every chartlang target
symbol is verified against `@invinite-org/chartlang-core`.
