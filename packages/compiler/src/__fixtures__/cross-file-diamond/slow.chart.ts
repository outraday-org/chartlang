// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Cross-file diamond fixture — `slow` binds `base` with a longer
// lookback override and re-exports it as a drawn indicator.

import { defineIndicator, plot } from "@invinite-org/chartlang-core";
import base from "./base.chart";

const slow = base.withInputs({ length: 50 });

export default defineIndicator({
    name: "Slow Trend",
    apiVersion: 1,
    compute: () => {
        const line = slow.output("line");
        plot(line.current, { title: "slow" });
    },
});
