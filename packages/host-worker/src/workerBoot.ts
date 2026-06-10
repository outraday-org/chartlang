// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Production worker entry. Bundled to `dist/worker-boot.js` via
 * `scripts/buildWorkerBoot.ts` and loaded by the main-side host through a
 * `new URL("./worker-boot.js", import.meta.url)` reference (see
 * `defaultWorkerFactory.ts`).
 *
 * The boot logic itself lives in {@link createWorkerBoot} so it can be
 * unit-tested against a `MessageChannel` port — this file is the thin
 * `self` adapter and is excluded from coverage (`vitest.config.ts`).
 *
 * @since 0.1
 * @stable
 */

import { createWorkerBoot, type WorkerBootScope } from "./createWorkerBoot";

createWorkerBoot(self as unknown as WorkerBootScope);
