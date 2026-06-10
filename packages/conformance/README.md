# @invinite-org/chartlang-conformance

`experimental`

Adapter conformance suite. It compiles bundled scenarios, runs them through the
runtime against a target adapter's capabilities, and asserts pinned plot,
drawing, alert, and diagnostic outcomes.

## Install

```bash
pnpm add -D @invinite-org/chartlang-conformance
```

## Public surface

- `runConformanceSuite(adapter, opts?) -> Promise<ConformanceReport>` drives
  every bundled scenario or an injected scenario subset.
- `ScenarioAssertion` covers `plot-hash`, `drawing-hash`, alert counts/messages,
  and diagnostic present/absent assertions.
- `ALL_SCENARIOS` includes Phase 1 smoke coverage, Phase 2 TA ports, Phase 3
  drawing parity, and Phase 4 scenarios for state, tick state, `barstate`,
  `syminfo`, `timeframe`, inputs, `request.security` NaN fallback, and
  unsupported intervals.
- `generateGoldenBars()`, `serialiseGoldenBars()`, `writeGoldenBars(path)`,
  and `GOLDEN_BARS_PATH` provide the deterministic 10 000-bar fixture.

## Minimum-viable API call

```ts
import { runConformanceSuite } from "@invinite-org/chartlang-conformance";
import myAdapter from "./my-adapter";

const report = await runConformanceSuite(myAdapter);
if (report.failed > 0) throw new Error(report.failures[0]?.message ?? "failed");
```

## Docs

See [`docs/adapters/conformance.md`](../../docs/adapters/conformance.md).

## License

MIT
