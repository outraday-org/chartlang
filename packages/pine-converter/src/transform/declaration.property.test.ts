// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { ExpressionNode } from "../ast/index.js";
import type { Argument } from "../ast/script.js";
import type { SourceSpan } from "../index.js";
import { mapDeclarationArgs } from "./declarationArgs.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";

const SPAN: SourceSpan = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 };

const NOT_MAPPED = "pine-converter/transform/indicator-arg-not-mapped";

function int(value: number): ExpressionNode {
    return { kind: "literal-expression", literalKind: "int", value: String(value), span: SPAN };
}
function arg(name: string, value: ExpressionNode): Argument {
    return { name, value, span: SPAN };
}

describe("mapDeclarationArgs — property", () => {
    it("every recognized max_*_count arg maps to exactly its bucket", () => {
        fc.assert(
            fc.property(
                fc.constantFrom(
                    ["max_lines_count", "lines"] as const,
                    ["max_labels_count", "labels"] as const,
                    ["max_boxes_count", "boxes"] as const,
                    ["max_polylines_count", "polylines"] as const,
                ),
                fc.integer({ min: 0, max: 100 }),
                ([argName, bucket], value) => {
                    const diag = new DiagnosticCollector();
                    const opts = mapDeclarationArgs([arg(argName, int(value))], diag);
                    expect(opts.maxDrawings[bucket]).toBe(value);
                    expect(diag.size).toBe(0);
                },
            ),
        );
    });

    it("a recognized precision arg maps without raising a diagnostic", () => {
        fc.assert(
            fc.property(fc.integer({ min: 0, max: 16 }), (value) => {
                const diag = new DiagnosticCollector();
                const opts = mapDeclarationArgs([arg("precision", int(value))], diag);
                expect(opts.precision).toBe(value);
                expect(diag.size).toBe(0);
            }),
        );
    });

    it("every unrecognized arg yields exactly one not-mapped warning", () => {
        fc.assert(
            fc.property(
                fc.uniqueArray(
                    fc.constantFrom(
                        "timeframe",
                        "timeframe_gaps",
                        "dynamic_requests",
                        "linktoseries",
                        "process_orders_on_close",
                        "behind_chart",
                    ),
                    { minLength: 1 },
                ),
                (names) => {
                    const diag = new DiagnosticCollector();
                    mapDeclarationArgs(
                        names.map((n) => arg(n, int(1))),
                        diag,
                    );
                    const warnings = diag.toArray().filter((d) => d.code === NOT_MAPPED);
                    expect(warnings).toHaveLength(names.length);
                },
            ),
        );
    });
});
