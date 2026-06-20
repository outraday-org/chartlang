// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// The hand-rolled Canvas 2D mock + its call-log hasher were generalised
// into the shared canvas sink in adapter-kit (Tasks 1–3). This module is
// kept as the documented `./testing` public entry point: conformance and
// the integration test import `MockCanvas2DContext` from
// `chartlang-example-canvas2d-adapter/testing`, so the path and the
// legacy name are preserved by re-exporting the shared
// `MockCanvasContext` under that alias. Implementation lives once in
// `@invinite-org/chartlang-adapter-kit/canvas`.
export {
    MockCanvasContext as MockCanvas2DContext,
    hashCallLog,
} from "@invinite-org/chartlang-adapter-kit/canvas";
export type { RecordedCall } from "@invinite-org/chartlang-adapter-kit/canvas";
