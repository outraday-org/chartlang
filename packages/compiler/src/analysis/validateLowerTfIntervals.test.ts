// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { IntervalDescriptor } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createProgramForSource } from "../program.js";
import { validateLowerTfIntervals } from "./validateLowerTfIntervals.js";

const interval = (value: string): IntervalDescriptor => ({ value, label: value, group: "test" });

function run(source: string, declared: ReadonlyArray<IntervalDescriptor>) {
    const { sourceFile, checker } = createProgramForSource(source, { sourcePath: "demo.chart.ts" });
    return validateLowerTfIntervals(sourceFile, checker, "demo.chart.ts", declared);
}

describe("validateLowerTfIntervals", () => {
    it("accepts strictly lower intervals", () => {
        const diagnostics = run(
            `import { request } from "@invinite-org/chartlang-core"; request.lowerTf({ interval: "30s" });`,
            [interval("1m")],
        );
        expect(diagnostics).toEqual([]);
    });

    it("rejects equal and higher intervals", () => {
        const equal = run(
            `import { request } from "@invinite-org/chartlang-core"; request.lowerTf({ interval: "5m" });`,
            [interval("5m")],
        );
        const higher = run(
            `import { request } from "@invinite-org/chartlang-core"; request.lowerTf({ interval: "5m" });`,
            [interval("1m")],
        );
        expect(equal[0]?.code).toBe("lower-tf-not-lower");
        expect(higher[0]?.message).toContain('main interval "1m"');
    });

    it("uses the smallest declared main interval", () => {
        const diagnostics = run(
            `import { request } from "@invinite-org/chartlang-core"; request.lowerTf({ interval: "5m" });`,
            [interval("1m"), interval("1h")],
        );
        expect(diagnostics).toHaveLength(1);
    });

    it("skips non-literal intervals and non-lowerTf calls", () => {
        expect(
            run(
                `import { request } from "@invinite-org/chartlang-core"; const tf = "5m"; request.lowerTf({ interval: tf }); request.security({ interval: "1D" });`,
                [interval("1m")],
            ),
        ).toEqual([]);
    });

    it("returns no diagnostics when no declared interval parses", () => {
        expect(
            run(
                `import { request } from "@invinite-org/chartlang-core"; request.lowerTf({ interval: "5m" });`,
                [interval("exotic")],
            ),
        ).toEqual([]);
        expect(
            run(
                `import { request } from "@invinite-org/chartlang-core"; request.lowerTf({ interval: "5m" });`,
                [],
            ),
        ).toEqual([]);
    });

    it("honours the intervalSeconds override on declared intervals", () => {
        const declared: IntervalDescriptor = {
            value: "exotic",
            label: "exotic",
            group: "test",
            intervalSeconds: 45,
        };
        expect(
            run(
                `import { request } from "@invinite-org/chartlang-core"; request.lowerTf({ interval: "30s" });`,
                [declared],
            ),
        ).toEqual([]);
        expect(
            run(
                `import { request } from "@invinite-org/chartlang-core"; request.lowerTf({ interval: "1m" });`,
                [declared],
            ),
        ).toHaveLength(1);
    });

    it("skips unparseable requested literals", () => {
        expect(
            run(
                `import { request } from "@invinite-org/chartlang-core"; request.lowerTf({ interval: "weird" });`,
                [interval("1m")],
            ),
        ).toEqual([]);
    });

    it("skips calls without an options object literal", () => {
        expect(
            run(
                `import { request } from "@invinite-org/chartlang-core"; const fn = request.lowerTf as unknown as (...args: ReadonlyArray<unknown>) => unknown; void fn; request.lowerTf(); const opts = { interval: "5m" }; request.lowerTf(opts);`,
                [interval("1m")],
            ),
        ).toEqual([]);
    });
});
