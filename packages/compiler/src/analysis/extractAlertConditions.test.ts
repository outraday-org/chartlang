// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { createProgramForSource } from "../program";
import { extractAlertConditions } from "./extractAlertConditions";

function run(source: string) {
    const { sourceFile, checker } = createProgramForSource(source, {
        sourcePath: "conditions.chart.ts",
    });
    return extractAlertConditions(sourceFile, checker, "conditions.chart.ts");
}

describe("extractAlertConditions", () => {
    it("extracts literal condition descriptors", () => {
        const result = run(`
import { defineAlertCondition } from "@invinite-org/chartlang-core";
export default defineAlertCondition({
    name: "cross",
    apiVersion: 1,
    conditions: {
        up: { title: "Up", description: "Close > EMA", defaultMessage: "{{ticker}} up" },
        "down-id": { title: "Down", description: "Close < EMA", defaultMessage: "{{ticker}} down" },
    },
    compute: () => {},
});
`);

        expect(result.diagnostics).toEqual([]);
        expect(result.alertConditions).toEqual([
            {
                id: "up",
                title: "Up",
                description: "Close > EMA",
                defaultMessage: "{{ticker}} up",
            },
            {
                id: "down-id",
                title: "Down",
                description: "Close < EMA",
                defaultMessage: "{{ticker}} down",
            },
        ]);
        expect(Object.isFrozen(result.alertConditions)).toBe(true);
        expect(Object.isFrozen(result.alertConditions[0])).toBe(true);
    });

    it("rejects a non-literal conditions map", () => {
        const result = run(`
import { defineAlertCondition } from "@invinite-org/chartlang-core";
const conditions = {};
export default defineAlertCondition({
    name: "cross",
    apiVersion: 1,
    conditions,
    compute: () => {},
});
`);

        expect(result.alertConditions).toEqual([]);
        expect(result.diagnostics.map((d) => d.code)).toEqual(["alert-condition-not-literal"]);
    });

    it("rejects missing conditions and non-object define arguments", () => {
        const missing = run(`
import { defineAlertCondition } from "@invinite-org/chartlang-core";
export default defineAlertCondition({
    name: "cross",
    apiVersion: 1,
    compute: () => {},
});
`);
        const nonObject = run(`
import { defineAlertCondition } from "@invinite-org/chartlang-core";
const opts = {};
export default defineAlertCondition(opts);
`);

        expect(missing.alertConditions).toEqual([]);
        expect(missing.diagnostics.map((d) => d.code)).toEqual(["alert-condition-not-literal"]);
        expect(nonObject.alertConditions).toEqual([]);
        expect(nonObject.diagnostics.map((d) => d.code)).toEqual(["alert-condition-not-literal"]);
    });

    it("rejects non-literal descriptor fields", () => {
        const result = run(`
import { defineAlertCondition } from "@invinite-org/chartlang-core";
const title = "Up";
export default defineAlertCondition({
    name: "cross",
    apiVersion: 1,
    conditions: {
        up: { title: title, description: "Close > EMA", defaultMessage: "{{ticker}} up" },
    },
    compute: () => {},
});
`);

        expect(result.alertConditions).toEqual([]);
        expect(result.diagnostics.map((d) => d.code)).toEqual([
            "alert-condition-field-not-literal",
        ]);
    });

    it("rejects non-object descriptors, computed ids, and missing string fields", () => {
        const result = run(`
import { defineAlertCondition } from "@invinite-org/chartlang-core";
const id = "up";
export default defineAlertCondition({
    name: "cross",
    apiVersion: 1,
    conditions: {
        [id]: { title: "Up", description: "Close > EMA", defaultMessage: "{{ticker}} up" },
        down: "not an object",
        flat: { title: "Flat", defaultMessage: "{{ticker}} flat" },
    },
    compute: () => {},
});
`);

        expect(result.alertConditions).toEqual([]);
        expect(result.diagnostics.map((d) => d.code)).toEqual([
            "alert-condition-not-literal",
            "alert-condition-field-not-literal",
            "alert-condition-field-not-literal",
        ]);
    });

    it("skips spread members while reading condition maps and descriptors", () => {
        const result = run(`
import { defineAlertCondition } from "@invinite-org/chartlang-core";
const extraConditions = {};
const extraFields = {};
export default defineAlertCondition({
    name: "cross",
    apiVersion: 1,
    conditions: {
        ...extraConditions,
        up: {
            ...extraFields,
            title: "Up",
            description: "Close > EMA",
            defaultMessage: "{{ticker}} up",
        },
    },
    compute: () => {},
});
`);

        expect(result.diagnostics).toEqual([]);
        expect(result.alertConditions).toEqual([
            {
                id: "up",
                title: "Up",
                description: "Close > EMA",
                defaultMessage: "{{ticker}} up",
            },
        ]);
    });
});
