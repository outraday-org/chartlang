# Conformance suite

`@invinite-org/chartlang-conformance` is the test harness that certifies
an adapter against the chartlang contract. It compiles bundled scenario
scripts, runs them through the runtime against your adapter's declared
`capabilities`, and asserts pinned plot, drawing, alert, and diagnostic
outcomes. Passing the suite is what lets an adapter claim
`apiVersion: 1` conformance.

## What the suite covers

The bundled scenario set exercises three contracts:

| Hook | Required behaviour |
| --- | --- |
| Capability honesty | The adapter accepts only emissions covered by its declared capabilities and the runtime drops unsupported families with the matching diagnostic or documented no-op. |
| Wire-schema compliance | Every payload crossing the adapter boundary satisfies the [Emission payloads](../spec/emissions.md) schemas and passes `validateEmission(...)`. |
| Determinism | Equivalent runs produce byte-identical emissions, including identical diagnostics and batch grouping. |

The scenarios cover indicator math against a deterministic 10 000-bar
candle fixture (Phase 1), the full TA primitive roster (Phase 2),
drawings (Phase 3), state slots, `barstate`, `syminfo`, `timeframe`,
`input.*`, `request.security` NaN fallback, lower-timeframe buckets,
and unsupported-interval behaviour (Phases 4-7). The scenario surface
hits the runtime ↔ capability-bag contract, not the renderer.

## Running it locally

The conformance suite is a vitest test. From an adapter package:

```ts
import { runConformanceSuite } from "@invinite-org/chartlang-conformance";
import { describe, expect, it } from "vitest";

import adapter from "./index.js";

describe("conformance", () => {
    it("passes the full chartlang conformance suite", async () => {
        const report = await runConformanceSuite(adapter);
        expect(report.failures).toEqual([]);
        expect(report.failed).toBe(0);
    });
});
```

Then:

```bash
pnpm test
```

`runConformanceSuite(adapter)` reads `adapter.capabilities` only. It
does not drive `adapter.candles` or call `adapter.onEmissions` — the
runner owns the candle iteration and the emission buffer so the test
surface is exactly the runtime ↔ capability-bag contract.

If a scenario fails because the adapter cannot render a kind, remove
that kind from the capability bag. If it fails because the adapter
claims a kind and renders the wrong wire shape, fix the translation.
Pinned hashes in the suite are the canonical expected values — adapter
output that drifts from them is the adapter's bug.

## Publishing your conformance report

Run the suite in the adapter repo, then generate the public report from
the same passing run:

```sh
pnpm conformance:report
```

The command writes two files at the adapter package root:
`CONFORMANCE.md` for reviewers and `conformance-report.json` for
tooling. Check both into the adapter's own repository. The Markdown
report lists every scenario by id, title, and pass/fail status; failed
scenarios include the assertion messages needed to investigate or
intentionally re-pin a changed result.

Projects can drift-gate the checked-in pair with:

```sh
pnpm tsx scripts/run-conformance.ts --report --check
```

The CI check fails when the regenerated report disagrees with the
checked-in copy — the same way the chartlang monorepo gates itself.

## Renderers

Under the hood, two renderers turn the report into the published
artefacts:

```ts
import {
    renderConformanceJson,
    renderConformanceMarkdown,
    runConformanceSuite,
} from "@invinite-org/chartlang-conformance";

declare const adapter: import("@invinite-org/chartlang-adapter-kit").Adapter;
const report = await runConformanceSuite(adapter);
const md: string = renderConformanceMarkdown(report);
const json: string = renderConformanceJson(report);
void md;
void json;
```

`renderConformanceMarkdown` produces the human-readable summary;
`renderConformanceJson` produces the machine-readable sidecar.

## Why this exists

The chartlang repo does not maintain a central adapter registry. The
contract, the conformance suite, and the published report are the
interoperability signal. A chart-library adapter is conformant if its
published report shows every scenario passing against a documented
`apiVersion: 1` line and a documented commit of the conformance
package.

## Cross-links

- The reference adapter walkthrough: [Writing an adapter](./writing-an-adapter.md).
- The contract the suite gates: [Adapter contract](./contract.md) and
  [Capabilities](./capabilities.md).
- Determinism rules: [Execution semantics § Determinism](../spec/semantics.md#determinism).
- Wire shapes the suite validates: [Emission payloads](../spec/emissions.md).
