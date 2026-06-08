// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { HoverRegistryEntry } from "../hoverRegistry.generated";
import type { HoverDoc } from "../types";

/**
 * Convert a generated hover-registry entry into the public hover payload.
 *
 * @since 0.4
 * @stable
 * @example
 *     const doc = toHoverDoc({
 *         fqn: "ta.ema",
 *         kind: "function",
 *         title: "ta.ema(source, length)",
 *         summary: "EMA.",
 *         since: "0.1",
 *         stability: "stable",
 *     });
 *     void doc;
 */
export function toHoverDoc(entry: HoverRegistryEntry): HoverDoc {
    return Object.freeze({
        title: entry.title,
        summary: entry.summary,
        ...(entry.paramTable === undefined ? {} : { paramTable: entry.paramTable }),
        ...(entry.examples === undefined ? {} : { examples: entry.examples }),
    });
}
