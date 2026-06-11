// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Inline `.chart.ts` sources used across the compiler test suite. Kept here
 * so positive and negative fixtures can be verified once and shared between
 * the unit, property, and integration tests.
 */

export const VALID_DEFINE = `
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "demo",
    apiVersion: 1,
    compute: () => {},
});
`;

export const EMA_CROSS = `
import { defineIndicator, ta, plot, alert } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "EMA cross",
    apiVersion: 1,
    compute: ({ bar }) => {
        const fast = ta.ema(bar.close, 12);
        const cross = ta.crossover(fast, bar.close);
        plot(fast);
        if (cross.current) alert("EMA crossed");
    },
});
`;

export const MULTI_EXPORT_COMPOSITION = `
import { defineIndicator, plot } from "@invinite-org/chartlang-core";

const base = defineIndicator({
    name: "Base",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { title: "line" }); },
});

export const sibling = defineIndicator({
    name: "Sibling",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { title: "echo" }); },
});

export default defineIndicator({
    name: "Composition",
    apiVersion: 1,
    compute: ({ bar }) => {
        const baseLine = base.output("line");
        const siblingEcho = sibling.output("echo");
        plot(baseLine, { title: "main-line" });
        plot(siblingEcho, { title: "main-echo" });
        void bar;
    },
});
`;
