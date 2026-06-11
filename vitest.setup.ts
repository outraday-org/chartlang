// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";

// Mirror of packages/runtime/vitest.setup.ts for the ROOT vitest run —
// without it, `pnpm test` (the CI entrypoint) executed every property
// test unseeded while per-package runs were pinned, so CI could flake
// on adversarial draws (observed: stdev tolerance edge on one leg).
// Per-test overrides (`fc.assert(prop, { seed: ... })`) still apply.
fc.configureGlobal({ seed: 42, numRuns: 25 });
