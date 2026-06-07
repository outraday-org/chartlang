// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

export { createDrawingHandle } from "./handle";
export { pushDrawing } from "./pushDrawing";
export { nextSubId, resetSubIdCounters } from "./subIdAllocator";
// Phase-3 Task 5 swaps the bare core re-export for the runtime-side
// `DRAW_NAMESPACE` that wires real per-kind impls (Task 5 lands the 6
// line-family kinds; Tasks 6–18 extend the namespace as their kinds
// ship). The namespace falls back to core's throwing-stub Proxy for
// every kind that hasn't shipped yet — same swap-seam pattern as
// Phase-2 `TA_REGISTRY` via `primitives.ts`.
export { DRAW_NAMESPACE as draw } from "./namespace";
