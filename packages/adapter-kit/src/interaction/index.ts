// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

export { createViewController, yRangeInWindow } from "./viewController.js";
export type {
    ViewController,
    ViewControllerOpts,
    WindowYInput,
    XWindow,
} from "./viewController.js";
export { attachInteraction, onDblCore, onDragCore, onWheelCore } from "./domWiring.js";
export type { InteractionHandlers } from "./domWiring.js";
