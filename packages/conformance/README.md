# @invinite-org/chartlang-conformance

`experimental`

Adapter conformance test suite. Drives every Phase-1 example
`.chart.ts` script through the compiler + runtime against a target
adapter's declared `capabilities` and asserts pinned plot hashes,
alert counts, and diagnostic codes.

## Install

```bash
pnpm add -D @invinite-org/chartlang-conformance
```

## Public surface

- `runConformanceSuite(adapter, opts?) → Promise<ConformanceReport>`
  — drives every bundled scenario against `adapter`. `opts.scenarios`,
  `opts.candles`, and `opts.compile` are injection seams for tests.
- `PHASE_1_SCENARIOS` — readonly array of the three Phase-1
  scenarios: `EMA_CROSS_SCENARIO`, `BOLLINGER_BANDS_SCENARIO`,
  `RSI_DIVERGENCE_SCENARIO`.
- `generateGoldenBars()` / `serialiseGoldenBars()` /
  `writeGoldenBars(path)` — deterministic 10 000-bar fixture
  generator. Seed `0xC0DE`, four 2 500-bar regimes
  (trend / range / high-vol / low-vol).
- `GOLDEN_BARS_PATH` — absolute path to the on-disk
  `fixtures/goldenBars.json` shipped alongside the package.

## Minimum-viable API call

```ts
import { runConformanceSuite } from "@invinite-org/chartlang-conformance";
import myAdapter from "./my-adapter";

const report = await runConformanceSuite(myAdapter);
if (report.failed > 0) {
    for (const f of report.failures) console.error(f.message);
    process.exit(1);
}
```

## Docs

See [`docs/adapters/conformance.md`](../../docs/adapters/conformance.md).

## License

MIT
