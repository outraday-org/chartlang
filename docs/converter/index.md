# Pine → chartlang converter

> **Stability:** `@experimental` · Drawings v1.

Convert **Pine Script v6** indicators to chartlang `.chart.ts` scripts.
The v1 slice is **drawings-focused** — it covers `line.new`, `label.new`,
`box.new`, `table.new`, `polyline.new`, and `linefill.new`, plus the
supporting surface (indicator declaration, inputs, `var`/`varip`,
`barstate`, literal-bounded control flow, and a partial `ta.*` / `math.*`
passthrough). It is a **source-to-source** translator: Pine text in,
chartlang text out, with structured diagnostics for anything it cannot
translate faithfully.

## Quick start

CLI — convert a file and write the chartlang output beside it:

```bash
pnpm add -D @invinite-org/chartlang-cli @invinite-org/chartlang-pine-converter
pnpm chartlang pine-convert strategy.pine --out strategy.chart.ts
```

Programmatic — convert a source string in-process:

```ts
import { convert } from "@invinite-org/chartlang-pine-converter";

const result = convert("//@version=6\nindicator('hello')");
if (result.output !== null) {
    // result.output is a chartlang `.chart.ts` source string.
}
```

## What you get

- **Deterministic source-to-source.** The same Pine input always produces
  byte-identical chartlang output. `convert` is synchronous and does not
  round-trip through the compiler; `convertFile` is the async fs wrapper.
- **Compiles through chartlang.** The emitted `.chart.ts` is written to
  compile through `@invinite-org/chartlang-compiler` (the round-trip is
  verified by the converter's own tests).
- **Structured diagnostics with source spans.** Every untranslatable
  idiom becomes a `Diagnostic` with a stable code, a severity, a message,
  a 1-based `SourceSpan`, and a suggested manual rewrite. See the
  [diagnostics reference](./diagnostics.md).
- **Three drawing strategies.** Pine drawing handles map onto chartlang
  via one of three "camps" depending on how the script manages them —
  see [supported surface](./supported.md#drawings).

## What it won't do

The converter is honest about its limits — these become diagnostics, not
silent mistranslations:

- **Strategies** are stripped to a `defineIndicator`; order
  sizing/fills are not reproduced (signal logic can be re-emitted as
  `alert(...)`).
- **UDTs (`type`), `method` declarations, matrices, and maps** have no v1
  analogue and hard-reject.
- **Unbounded dynamic drawing collections** — a collection with no
  detectable cap (no `max_*_count`, no ring-buffer eviction) hard-rejects;
  cap it to land in a bounded camp.
- **`linefill` between two lines** is approximated as a filled
  `draw.rotatedRectangle` quad — chartlang has no fill-between-series
  primitive yet.

See the [reject catalogue](./rejects.md) for the full list with the
recommended Pine rewrites, and the
[translating-from-pine skill reference](https://github.com/outraday-org/chartlang/blob/main/skills/chartlang-coding/references/translating-from-pine.md)
for an author-focused porting guide.

## Pages

- [Usage](./usage.md) — CLI flags and the programmatic API.
- [Supported surface](./supported.md) — drawings, inputs, control flow,
  and the `ta.*` / `math.*` / `str.*` passthrough.
- [Rejects + manual rewrites](./rejects.md) — the hard-reject catalogue.
- [Diagnostics reference](./diagnostics.md) — every diagnostic code.

The narrative [Pine migration guide](../spec/pine-migration.md) covers the
conceptual mapping between the two languages.
