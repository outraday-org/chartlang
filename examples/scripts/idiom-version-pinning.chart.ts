// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Idiom · Version Pinning",
    // Idiom: `apiVersion` is a numeric LITERAL pin selecting the frozen language
    // contract (docs/language/version-pinning.md). The compiler refuses any value
    // but the literal `1` (`api-version-mismatch`); `1` is forever — this script
    // compiles, loads, and emits identical numbers on any conforming chartlang v1
    // implementation. Package semver and script apiVersion are orthogonal axes.
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.sma(bar.close, 20), { title: "SMA(20)", color: "#26a69a" });
    },
});
