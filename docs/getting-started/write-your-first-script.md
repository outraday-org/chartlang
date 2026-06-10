# Write your first script

Author a complete indicator, compile it, and watch it render. The
walkthrough takes about ten minutes and produces a working EMA-cross
plot with alert lines.

## Install the script-author package

Script sources only need `@invinite-org/chartlang-core` (types and the
`defineIndicator` constructor) plus `@invinite-org/chartlang-cli` to
compile:

```bash
pnpm add -D @invinite-org/chartlang-core @invinite-org/chartlang-cli typescript
```

## Write the script

Save the file as `ema-cross.chart.ts`. Every chartlang script is a
TypeScript module that default-exports exactly one `defineIndicator`
call:

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "EMA Cross",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot, alert }) {
        const fast = ta.ema(bar.close, 12);
        const slow = ta.ema(bar.close, 26);
        plot(fast, { color: "#26a69a", title: "EMA(12)" });
        plot(slow, { color: "#ef5350", title: "EMA(26)" });
        if (ta.crossover(fast, slow).current) {
            alert("EMA(12) crossed above EMA(26)", { severity: "info" });
        }
        if (ta.crossunder(fast, slow).current) {
            alert("EMA(12) crossed below EMA(26)", { severity: "warning" });
        }
    },
});
```

Two patterns are load-bearing:

- **Top-level imports** feed the compiler's capability extractor — it
  walks the named-import set to know which primitive families the
  script touches.
- **Destructured `compute` params** receive the runtime's slot-aware
  implementations. `ta`, `plot`, `alert`, `hline`, and the typed `bar`
  object all arrive as parameters; the compiler rewrites each call to
  inject a callsite id so per-bar state survives across ticks.

Both forms must appear together. Importing `ta` at the top without
destructuring it inside `compute` (or vice versa) is a configuration
error.

## Compile

The CLI emits a sibling triple next to the source — a self-contained
ESM bundle, a JSON capability manifest, and a `.d.ts` types file:

```bash
pnpm chartlang compile ema-cross.chart.ts
```

```text
ema-cross.chart.ts                  (source — yours)
ema-cross.chart.js                  (~27 KB ESM bundle)
ema-cross.chart.manifest.json       (capabilities, inputs, lookback)
ema-cross.chart.d.ts                (manifest types for IDEs)
```

The bundle is data-URL importable, so a worker host can `import()` it
without any further build step. The manifest declares everything the
adapter needs to gate emissions: which plot kinds, drawing kinds, alert
kinds, and input shapes the script will use, plus its `maxLookback`.

Useful flags:

- `--out <dir>` writes the triple into a sibling directory instead of
  next to the source.
- `--sourcemap` emits an external `<base>.chart.js.map` for debugging.
- `--minify` runs esbuild's minifier on the bundle.

## See it render

Two demos in the repo will load the compiled triple immediately:

- **React editor + live chart** —
  `cd examples/react-demo && pnpm dev`, open `http://localhost:5173`,
  paste the script in. Re-renders on every keystroke.
- **Canvas2d playground** — from the repo root,
  `pnpm dlx vite --port 5273`, open
  `http://localhost:5273/examples/canvas2d-adapter/playground/`. The
  playground page fetches `examples/scripts/ema-cross.chart.js` from
  disk, so it picks up your re-compiled output if you replace it.

For a node-side end-to-end test that mirrors what an embedder writes,
see `examples/canvas2d-adapter/e2e-smoke.ts`.

## The compiler catches type errors

The compiler runs the TypeScript program against
`@invinite-org/chartlang-core`'s ambient declarations before any
rewrite happens, so semantic errors surface as `type-error` compile
diagnostics. Try injecting a mistake (the fence is tagged `no-gate` so
the docs-snippets compile check ignores this deliberately-broken
example):

```ts no-gate
import { defineIndicator } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "type-broken",
    apiVersion: 1,
    compute({ bar, ta, plot }) {
        // `bar.close` is a number; `ta.ema` expects a Source.
        // The compiler flags this before the rewrite step.
        const wrong: string = ta.ema(bar.close, 14);
        plot(wrong);
    },
});
```

`pnpm chartlang compile type-broken.chart.ts` exits non-zero and
prints a `type-error` diagnostic at the offending line and column.
That same diagnostic surfaces in the editor demo as an inline marker
without ever leaving the browser tab.

## Explore primitives

The full auto-generated reference lives in the docs site:

- [`/primitives/ta/`](../primitives/ta/) — 90 technical-analysis
  primitives (moving averages, oscillators, trend, volatility, volume,
  S/R, statistical helpers).
- [`/primitives/draw/`](../primitives/draw/) — 61 drawing primitives
  (lines, boxes, Fibonacci tools, Gann tools, pitchforks, harmonic
  patterns, Elliott waves, cycles).
- [`/primitives/alert/`](../primitives/alert/alert) — runtime alerts,
  alert conditions, severities.
- [`/primitives/input/`](../primitives/input/bool) — twelve typed
  input shapes the script can declare.
- [`/primitives/state/`](../primitives/state/float) — cross-bar
  scalar state.
- [`/primitives/request/`](../primitives/request/security) —
  multi-timeframe + cross-symbol data.

Every page is regenerated from JSDoc by `pnpm docs:generate`; the
`pnpm docs:gate` CI check fails on drift.

## Next steps

- [Embed in your chart](./embed-in-our-chart.md) to run user-supplied
  scripts inside a product UI.
- [Write your first adapter](./write-your-first-adapter.md) to teach
  a new chart library how to render chartlang emissions.
- [Language overview](../language/overview.md) for the eDSL surface,
  series semantics, and the list of forbidden constructs.
