// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";

// Deterministic seed for every `fc.assert(...)` call in this package.
// Per-test overrides (`fc.assert(prop, { seed: ... })`) still apply.
// Bump this seed deliberately when you want to surface new counter-examples.
fc.configureGlobal({ seed: 42, numRuns: 25 });
