---
"@invinite-org/chartlang-pine-converter": minor
---

Convert Pine's transparency-carrying colour forms — `color.new(base, transp)`
and the 4-arg `color.rgb(r, g, b, transp)` — across the **plot / hline /
table** paths, and gate the `color` import so the output compiles.

- **Lowering (shared rule):** `colorConvert.ts`'s `convertColorWith(node, emit)`
  is the single colour rule the plot (`plotFamily.ts`), table (`tables.ts`), and
  linefill paths share. A literal `#RRGGBB`/palette base + literal `transp` folds
  to a quoted `#RRGGBBAA` hex string (`alpha = round(255 * (100 - transp) /
  100)`); a **dynamic** base or `transp` emits `color.withAlpha(<base>, (100 -
  transp) / 100)` (core's `withAlpha` takes alpha in 0–1). A 3-arg
  `color.rgb(r, g, b)` passes through. Every transparency fold raises a
  `color-transp-approximated` info.
- **Import gating:** `scanUsage` (`codegen/usage.ts`) gains a `color: boolean`
  flag, force-on whenever a `color.*` member survives in the output
  (`color.withAlpha`, a 3-arg `color.rgb`, or a bare palette member). `color`
  joins the core import list as a module-scope namespace (like `math`/`str`) —
  it is NEVER added to the `compute` destructure. An all-hex script imports no
  `color` (byte-compatible — no spurious import).
- Fixtures `51-color-rgb-transp` (plot + hline, hex, no import),
  `52-color-new-literal` (table cell, hex, no import), and
  `53-color-dynamic-base` (`withAlpha` + 3-arg `color.rgb` passthrough +
  surviving palette member, `color` imported) round-trip through the compiler.
