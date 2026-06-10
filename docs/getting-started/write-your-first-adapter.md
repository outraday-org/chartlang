# Write your first adapter

Teach a new chart library how to render chartlang emissions. The
adapter contract is small — declare what you support, feed candles,
translate emissions — and a conformance suite (220 scenarios) tells
you when the implementation is correct.

## Scaffold

The CLI generates a complete starter package — source, smoke test,
conformance test, and a report script:

```bash
pnpm dlx @invinite-org/chartlang-cli scaffold-adapter my-trading-chart
cd my-trading-chart
pnpm install
```

The scaffolded package is intentionally `"private": true` — adapter
packages live in consumer repositories and publish under the owner's
own scope when they ship. Re-running `scaffold-adapter` against a
non-empty directory refuses to overwrite (idempotence is enforced; no
`--force` flag).

## Declare capabilities honestly

The capability surface is the source of truth. Anything you do not
declare is a silent runtime no-op — scripts that emit unsupported
plot kinds, drawing kinds, or alert kinds drop the emission and log
a diagnostic instead of crashing the renderer.

```ts no-gate
import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";

export const myCapabilities: Capabilities = {
    plots: capabilities.union(capabilities.line(), capabilities.area()),
    drawings: new Set(["line", "horizontal-line"]),
    alerts: new Set(["toast"]),
    alertConditions: false,
    logs: true,
    inputs: new Set(["int", "float", "bool", "color", "source"]),
    intervals: [{ value: "1D", label: "1 day", group: "daily" }],
    multiTimeframe: false,
    subPanes: 1,
    symInfoFields: new Set(["ticker", "mintick", "timezone"]),
    maxDrawingsPerScript: { lines: 100, labels: 0, boxes: 0, polylines: 0, other: 0 },
    maxLookback: 5000,
    maxTickHz: 10,
};
```

Do not declare a plot kind until the renderer can both create AND
update its series. Do not declare a drawing kind until you implement
both the create-or-update branch and the remove branch. Do not declare
`multiTimeframe` unless `candles({ interval })` can supply secondary
streams for every entry in `intervals`.

## Implement the adapter

An adapter is a single object built with `defineAdapter`:

```ts no-gate
import { defineAdapter, mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
import type {
    Adapter,
    CandleEvent,
    RunnerEmissions,
} from "@invinite-org/chartlang-adapter-kit";

import { myCapabilities } from "./capabilities";

async function* candles(opts: { interval: string }): AsyncIterable<CandleEvent> {
    void opts;
    yield { kind: "history", bars: [] };
    // for await (const bar of livePriceStream()) yield { kind: "close", bar };
}

function onEmissions(emissions: RunnerEmissions): void {
    for (const plot of emissions.plots) {
        // hand off to your chart library's series API
        void plot;
    }
    for (const drawing of emissions.drawings) {
        if (drawing.op === "remove") {
            // remove from your renderer
        } else {
            // create or update
        }
        void drawing;
    }
    for (const alert of emissions.alerts) {
        // hand off to your toast / notification surface
        void alert;
    }
}

export const adapter: Adapter = defineAdapter({
    id: "my-trading-chart",
    name: "My Trading Chart",
    capabilities: myCapabilities,
    candles,
    onEmissions,
    dispose: () => {},
});
export default adapter;
```

The full contract — every `CandleEvent` kind, every
`PlotEmission` / `DrawingEmission` / `AlertEmission` shape, the
adapter-facing `symInfo`, and the `dispose` cleanup contract — lives in
the [adapter author guide](../adapters/writing-an-adapter.md). The
[`examples/canvas2d-adapter`](https://github.com/outraday-org/chartlang/tree/main/examples/canvas2d-adapter)
package is the reference implementation worth copying from.

## Validate with the conformance suite

The scaffolded package ships a passing-by-construction conformance
test plus a report script:

```bash
pnpm test                      # unit + conformance via vitest
pnpm conformance:report        # writes CONFORMANCE.md + conformance-report.json
```

`@invinite-org/chartlang-conformance` ships 220 scenarios covering
every plot kind, every drawing kind, every alert kind, multi-timeframe
flows, drawing-budget overflow, and unsupported-capability gating. Each
scenario is gated by capability — your adapter only runs the scenarios
that match what you declared, so a minimal "lines and toasts" adapter
sees a focused subset. The committed `CONFORMANCE.md` is human-readable
and diff-friendly; the JSON sibling powers tooling.

The reference adapter under
[`examples/canvas2d-adapter/`](https://github.com/outraday-org/chartlang/tree/main/examples/canvas2d-adapter)
runs the full 220 — its committed `CONFORMANCE.md` shows what a
green report looks like. From the repo root, `pnpm conformance` runs
the suite against that reference adapter.

## Next steps

- [Adapter contract](../adapters/contract.md) — the deep type-level
  reference for `Adapter`, `Capabilities`, `CandleEvent`, every
  emission shape.
- [Writing an adapter](../adapters/writing-an-adapter.md) — the
  long-form tutorial with per-emission render code.
- [Conformance](../adapters/conformance.md) — the suite, the report
  format, and how scenarios are gated by capability.
