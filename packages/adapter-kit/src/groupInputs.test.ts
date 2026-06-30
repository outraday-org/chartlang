// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { input } from "@invinite-org/chartlang-core";
import type { InputSchema } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { groupInputs } from "./groupInputs.js";

function flattenNames(inputs: InputSchema): string[] {
    return groupInputs(inputs).flatMap((section) =>
        section.rows.flatMap((row) => row.map((entry) => entry.name)),
    );
}

describe("groupInputs", () => {
    it("keeps grouped sections and entries in declaration order", () => {
        const inputs = {
            fast: input.int(9, { group: "A" }),
            slow: input.int(21, { group: "A" }),
            source: input.source("close", { group: "B" }),
        } satisfies InputSchema;

        const groups = groupInputs(inputs);

        expect(groups.map((group) => group.title)).toEqual(["A", "B"]);
        expect(groups[0]?.rows.map((row) => row.map((entry) => entry.name))).toEqual([
            ["fast"],
            ["slow"],
        ]);
        expect(groups[1]?.rows.map((row) => row.map((entry) => entry.name))).toEqual([["source"]]);
        expect(groups[0]?.rows[0]?.[0]?.descriptor).toBe(inputs.fast);
    });

    it("groups shared inline ids into one row within a group", () => {
        const inputs = {
            fast: input.int(9, { group: "MA", inline: "lengths" }),
            slow: input.int(21, { group: "MA", inline: "lengths" }),
            enabled: input.bool(true, { group: "MA" }),
        } satisfies InputSchema;

        expect(groupInputs(inputs)).toEqual([
            {
                title: "MA",
                rows: [
                    [
                        { name: "fast", descriptor: inputs.fast },
                        { name: "slow", descriptor: inputs.slow },
                    ],
                    [{ name: "enabled", descriptor: inputs.enabled }],
                ],
            },
        ]);
    });

    it("preserves declaration order through the flattened grouped structure", () => {
        const inputs = {
            fast: input.int(9, { group: "A", inline: "lengths" }),
            slow: input.int(21, { group: "A", inline: "lengths" }),
            middle: input.bool(true, { group: "A" }),
            color: input.color("#26a69a", { group: "B" }),
        } satisfies InputSchema;

        expect(flattenNames(inputs)).toEqual(["fast", "slow", "middle", "color"]);
    });

    it("starts a new row when the same inline id reappears after another row", () => {
        const inputs = {
            fast: input.int(9, { group: "A", inline: "lengths" }),
            enabled: input.bool(true, { group: "A" }),
            slow: input.int(21, { group: "A", inline: "lengths" }),
        } satisfies InputSchema;

        expect(groupInputs(inputs)[0]?.rows.map((row) => row.map((entry) => entry.name))).toEqual([
            ["fast"],
            ["enabled"],
            ["slow"],
        ]);
        expect(flattenNames(inputs)).toEqual(["fast", "enabled", "slow"]);
    });

    it("isolates a shared inline id across two different groups", () => {
        // `lastInline` is tracked per-section, so the same inline name reused in
        // a different group must start a fresh row in that group — never merge
        // across the section boundary.
        const inputs = {
            a1: input.int(1, { group: "A", inline: "row" }),
            a2: input.int(2, { group: "A", inline: "row" }),
            b1: input.int(3, { group: "B", inline: "row" }),
            b2: input.int(4, { group: "B", inline: "row" }),
        } satisfies InputSchema;

        const groups = groupInputs(inputs);
        expect(groups.map((group) => group.title)).toEqual(["A", "B"]);
        expect(groups[0]?.rows.map((row) => row.map((entry) => entry.name))).toEqual([
            ["a1", "a2"],
        ]);
        expect(groups[1]?.rows.map((row) => row.map((entry) => entry.name))).toEqual([
            ["b1", "b2"],
        ]);
    });

    it("returns an empty array for an empty input schema", () => {
        expect(groupInputs({})).toEqual([]);
    });

    it("puts all ungrouped inputs into a null-titled section", () => {
        const inputs = {
            length: input.int(20),
            source: input.source("close"),
        } satisfies InputSchema;

        expect(groupInputs(inputs)).toEqual([
            {
                title: null,
                rows: [
                    [{ name: "length", descriptor: inputs.length }],
                    [{ name: "source", descriptor: inputs.source }],
                ],
            },
        ]);
    });

    it("includes external-series descriptors like other inputs", () => {
        const inputs = {
            earnings: {
                kind: "external-series",
                name: "earnings",
                schema: { kind: "external-series-schema" },
                group: "Events",
            },
        } satisfies InputSchema;

        expect(groupInputs(inputs)).toEqual([
            {
                title: "Events",
                rows: [[{ name: "earnings", descriptor: inputs.earnings }]],
            },
        ]);
    });
});
