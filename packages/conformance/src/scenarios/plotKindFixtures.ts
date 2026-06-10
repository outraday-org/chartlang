// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Build the inline `defineIndicator` source shared by the Phase 5
 * `plotKind*` conformance scenarios. Each scenario plots `bar.close`
 * with one `PlotStyle` kind; only the manifest `name` and the
 * `plot(...)` body differ, so the surrounding wrapper lives here.
 *
 * @since 0.5
 * @stable
 * @example
 *     const src = plotKindSource("PlotKind arrow", 'plot(bar.close, {});');
 *     void src;
 */
export function plotKindSource(name: string, plotBody: string): string {
    return `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: ${JSON.stringify(name)},
    apiVersion: 1,
    overlay: true,
    compute({ bar, plot }) {
        ${plotBody}
    },
});
`;
}
