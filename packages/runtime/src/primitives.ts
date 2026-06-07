// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { TaNamespace } from "@invinite-org/chartlang-core";

import { TA_REGISTRY } from "./ta";

/**
 * The runtime's `ta` namespace as the compiled script sees it. Task 6's
 * `createScriptRunner` puts this on the `ComputeContext` it hands the
 * compiled script; Task 7 swapped the body from a throw-stub to the
 * real {@link TA_REGISTRY} (`./ta/registry`). Identity is preserved
 * across the swap — `buildComputeContext.ts` still imports `ta` from
 * here and the runner contract from Task 6 stays untouched.
 *
 * The runtime impls take a compiler-injected `slotId` as their first
 * argument; the compiler erases the extra arg at the type boundary so
 * `ComputeContext.ta: TaNamespace` (script-facing) and the bundled call
 * `ta.ema("slot-id", src, length)` are structurally compatible at
 * runtime.
 *
 * @since 0.1
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // type S = typeof ta;
 */
export const ta: TaNamespace = TA_REGISTRY as unknown as TaNamespace;

export { alert, draw, hline, plot } from "./emit";
