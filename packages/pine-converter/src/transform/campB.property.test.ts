// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { CallExpression } from "../ast/index.js";
import type { DrawingCallSite, HandleType, SymbolInfo } from "../semantic/index.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import type { RingBucket } from "./ringHelper.js";
import { CHARTLANG_BUCKET_CAP, resolveRingCap } from "./ringHelper.js";

const SPAN = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 } as const;

function syntheticSite(handleType: HandleType, cap: number): DrawingCallSite {
    const call: CallExpression = {
        kind: "call-expression",
        callee: {
            kind: "member-access-expression",
            head: null,
            chain: ["line", "new"],
            span: SPAN,
        },
        args: [],
        span: SPAN,
    };
    const symbol: SymbolInfo = {
        name: "coll",
        kind: "var-variable",
        declarationSpan: SPAN,
        typeAnnotation: null,
        qualifier: "series",
        handleType,
    };
    return {
        call,
        constructor: "line.new",
        handleType,
        camp: { kind: "camp-b", collectionSymbol: symbol, cap, capSource: "max-count-decl" },
        span: SPAN,
    };
}

const BUCKETS: readonly RingBucket[] = ["line", "box", "label", "polyline"];

describe("resolveRingCap — properties", () => {
    it("returns min(pineCap, bucketCap) for any positive cap", () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...BUCKETS),
                fc.integer({ min: 1, max: 5000 }),
                (bucket, pineCap) => {
                    const diagnostics = new DiagnosticCollector();
                    const k = resolveRingCap(syntheticSite(bucket, pineCap), diagnostics);
                    expect(k).toBe(Math.min(pineCap, CHARTLANG_BUCKET_CAP[bucket]));
                },
            ),
        );
    });

    it("emits cap-mismatch exactly when the bucket clamp lowers the cap", () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...BUCKETS),
                fc.integer({ min: 1, max: 5000 }),
                (bucket, pineCap) => {
                    const diagnostics = new DiagnosticCollector();
                    resolveRingCap(syntheticSite(bucket, pineCap), diagnostics);
                    const clamped = pineCap > CHARTLANG_BUCKET_CAP[bucket];
                    expect(diagnostics.has("pine-converter/transform/cap-mismatch")).toBe(clamped);
                },
            ),
        );
    });

    it("rejects every non-positive cap with ring-buffer-zero-cap", () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...BUCKETS),
                fc.integer({ min: -1000, max: 0 }),
                (bucket, pineCap) => {
                    const diagnostics = new DiagnosticCollector();
                    expect(resolveRingCap(syntheticSite(bucket, pineCap), diagnostics)).toBeNull();
                    expect(diagnostics.has("pine-converter/transform/ring-buffer-zero-cap")).toBe(
                        true,
                    );
                },
            ),
        );
    });
});
