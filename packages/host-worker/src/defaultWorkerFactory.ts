// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { WorkerLike } from "./types";

/**
 * Browser-only fallback when `createWorkerHost` is called without an
 * explicit `workerLike`. Constructs a real `Worker` against the bundled
 * `dist/worker-boot.js` sibling. In a real Node test runner `Worker` is not
 * a global so calling this throws a `ReferenceError`; tests always inject a
 * `MessageChannel`-backed `WorkerLike` instead, and the coverage test in
 * `defaultWorkerFactory.test.ts` stubs `globalThis.Worker` to exercise the
 * construction path.
 *
 * @since 0.1
 * @stable
 * @example
 *     // const worker = defaultWorkerFactory();  // browser only
 *     const fn: typeof defaultWorkerFactory = defaultWorkerFactory;
 *     void fn;
 */
export function defaultWorkerFactory(): WorkerLike {
    const url = new URL("./worker-boot.js", import.meta.url);
    return new Worker(url, { type: "module" });
}
