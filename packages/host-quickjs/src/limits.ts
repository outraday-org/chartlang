// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { QuickJsHostLimits } from "./types";

/**
 * Phase-5 default QuickJS hard limits. Frozen so consumers cannot mutate the
 * singleton; per-host overrides are merged by `createQuickJsHost` in Task 7.
 *
 * @since 0.5
 * @experimental
 * @example
 *     import { DEFAULT_QUICKJS_LIMITS } from "@invinite-org/chartlang-host-quickjs";
 *     const heap = DEFAULT_QUICKJS_LIMITS.maxHeapBytes;
 *     void heap;
 */
export const DEFAULT_QUICKJS_LIMITS: QuickJsHostLimits = Object.freeze({
    maxHeapBytes: 64 * 1024 * 1024,
    maxStepMs: 1,
});
