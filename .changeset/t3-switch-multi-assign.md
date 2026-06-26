---
"@invinite-org/chartlang-pine-converter": minor
---

Support comma multi-assignment `switch` arm bodies and turn a value-position
`switch` into a clean reject (T3).

- **`switch` arms with a comma-separated assignment list now convert.** A Pine
  arm body such as `"X" => a := 8, b := 21` (Trend Wizard's `preset_select`
  uses ten per branch) parses into N statements and lowers each in source
  order before the `break;` — no element is dropped. The switch lowering was
  already list-aware; the parser now populates the arm body as a list. Fixture
  `47-switch-multi-assign` round-trips through the compiler.
- **A `switch` used as a value (`x = switch s …`, Trend Wizard's `cf_ma`) is
  now a clean reject** — `pine-converter/parse/switch-expression-unsupported`
  (error) — instead of silently-broken output. The parser recovers the switch
  header + arm block and resumes at the next statement. Rewrite it as a chained
  ternary, or assign inside each arm body (which IS supported). Lowering a
  value-position switch to a ternary chain is a tracked follow-up.
