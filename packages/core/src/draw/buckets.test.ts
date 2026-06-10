// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { KIND_BUCKET, bucketFor } from "./buckets.js";
import type { DrawingBucket } from "./buckets.js";
import { DRAWING_KINDS } from "./drawingKind.js";
import type { DrawingKind } from "./drawingKind.js";

const VALID_BUCKETS: ReadonlySet<DrawingBucket> = new Set([
    "lines",
    "labels",
    "boxes",
    "polylines",
    "other",
]);

describe("KIND_BUCKET", () => {
    it("has 62 entries (one per drawing kind)", () => {
        expect(KIND_BUCKET.size).toBe(62);
    });

    it("covers every kind in DRAWING_KINDS exhaustively", () => {
        for (const k of DRAWING_KINDS) {
            expect(KIND_BUCKET.has(k)).toBe(true);
        }
    });

    it("only maps to canonical bucket names", () => {
        for (const bucket of KIND_BUCKET.values()) {
            expect(VALID_BUCKETS.has(bucket)).toBe(true);
        }
    });

    it("pins the line family to the 'lines' bucket", () => {
        expect(KIND_BUCKET.get("line")).toBe("lines");
        expect(KIND_BUCKET.get("horizontal-line")).toBe("lines");
        expect(KIND_BUCKET.get("horizontal-ray")).toBe("lines");
        expect(KIND_BUCKET.get("vertical-line")).toBe("lines");
        expect(KIND_BUCKET.get("cross-line")).toBe("lines");
        expect(KIND_BUCKET.get("trend-angle")).toBe("lines");
    });

    it("pins boxes / circles / ellipses / triangles to 'boxes'", () => {
        expect(KIND_BUCKET.get("rectangle")).toBe("boxes");
        expect(KIND_BUCKET.get("rotated-rectangle")).toBe("boxes");
        expect(KIND_BUCKET.get("triangle")).toBe("boxes");
        expect(KIND_BUCKET.get("circle")).toBe("boxes");
        expect(KIND_BUCKET.get("ellipse")).toBe("boxes");
    });

    it("pins text / arrow family / marker to 'labels'", () => {
        expect(KIND_BUCKET.get("text")).toBe("labels");
        expect(KIND_BUCKET.get("arrow")).toBe("labels");
        expect(KIND_BUCKET.get("arrow-marker")).toBe("labels");
        expect(KIND_BUCKET.get("arrow-mark-up")).toBe("labels");
        expect(KIND_BUCKET.get("arrow-mark-down")).toBe("labels");
        expect(KIND_BUCKET.get("marker")).toBe("labels");
    });

    it("pins channels / curves / freehand / patterns / elliott to 'polylines'", () => {
        for (const kind of [
            "trend-channel",
            "flat-top-bottom",
            "disjoint-channel",
            "regression-trend",
            "arc",
            "curve",
            "double-curve",
            "pen",
            "highlighter",
            "brush",
            "pitchfork",
            "pitchfan",
            "xabcd-pattern",
            "cypher-pattern",
            "head-and-shoulders",
            "abcd-pattern",
            "triangle-pattern",
            "three-drives-pattern",
            "elliott-impulse-wave",
            "elliott-correction-wave",
            "elliott-triangle-wave",
            "elliott-double-combo",
            "elliott-triple-combo",
            "polyline",
            "path",
        ] satisfies ReadonlyArray<DrawingKind>) {
            expect(KIND_BUCKET.get(kind)).toBe("polylines");
        }
    });

    it("pins fib / gann / cycles / containers to 'other'", () => {
        for (const kind of [
            "fib-retracement",
            "fib-trend-extension",
            "fib-channel",
            "fib-time-zone",
            "fib-wedge",
            "fib-speed-fan",
            "fib-speed-arcs",
            "fib-spiral",
            "fib-circles",
            "fib-trend-time",
            "gann-box",
            "gann-square-fixed",
            "gann-square",
            "gann-fan",
            "cyclic-lines",
            "time-cycles",
            "sine-line",
            "group",
            "frame",
            "table",
        ] satisfies ReadonlyArray<DrawingKind>) {
            expect(KIND_BUCKET.get(kind)).toBe("other");
        }
    });

    it("distributes 62 kinds across the 5 buckets per spec", () => {
        const counts: Record<DrawingBucket, number> = {
            lines: 0,
            labels: 0,
            boxes: 0,
            polylines: 0,
            other: 0,
        };
        for (const bucket of KIND_BUCKET.values()) {
            counts[bucket] += 1;
        }
        // 6 line kinds + 5 (rectangle, rotated, triangle, circle, ellipse) box
        // kinds + 6 label kinds (text, arrow×4, marker) + 25 polyline kinds +
        // 20 other kinds = 62. Polylines spans curves (3), freehand (3),
        // channels (4), patterns (6), elliott (5), pitchforks (2), polyline +
        // path (2) = 25. Other spans fib (10), gann (4), cycles (3),
        // containers (2), and table (1) = 20.
        expect(counts.lines).toBe(6);
        expect(counts.boxes).toBe(5);
        expect(counts.labels).toBe(6);
        expect(counts.polylines).toBe(25);
        expect(counts.other).toBe(20);
        expect(counts.lines + counts.boxes + counts.labels + counts.polylines + counts.other).toBe(
            62,
        );
    });
});

describe("bucketFor", () => {
    it("returns a valid bucket for every kind", () => {
        for (const k of DRAWING_KINDS) {
            const bucket = bucketFor(k);
            expect(VALID_BUCKETS.has(bucket)).toBe(true);
        }
    });

    it("returns the same value as KIND_BUCKET.get for every kind", () => {
        for (const k of DRAWING_KINDS) {
            expect(bucketFor(k)).toBe(KIND_BUCKET.get(k));
        }
    });

    it("throws for kinds not in KIND_BUCKET (defensive branch)", () => {
        // Cast an unknown string to exercise the defensive branch. In practice
        // the compiler prevents this — but the runtime guard pins the contract
        // for forward-compat (e.g. a wire-format kind whose bucket entry has
        // not yet landed in a downstream release).
        const phantomKind = "phantom-kind" as DrawingKind;
        expect(() => bucketFor(phantomKind)).toThrow(
            "No bucket assigned for drawing kind 'phantom-kind'",
        );
    });
});
