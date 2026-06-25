// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { SEAM_IDS, type SeamId, isSeamId, seamTemplateFor } from "./seamTemplates.js";

// The app SSOT for the per-library seam bodies. Imported directly from the
// monorepo source so this test fails the moment a seam diverges from the
// matrix-proven `apps/react-starter/src/lib/chart/seamVariants.ts`.
const SEAM_VARIANTS_PATH = fileURLToPath(
    new URL("../../../apps/react-starter/src/lib/chart/seamVariants.ts", import.meta.url),
);

async function loadVariants(): Promise<
    ReadonlyArray<{ id: string; pkg: string; seamSource: string }>
> {
    const mod = (await import(SEAM_VARIANTS_PATH)) as {
        SEAM_VARIANTS: ReadonlyArray<{ id: string; pkg: string; seamSource: string }>;
    };
    return mod.SEAM_VARIANTS;
}

describe("isSeamId", () => {
    it("accepts every bundled id", () => {
        for (const id of SEAM_IDS) {
            expect(isSeamId(id)).toBe(true);
        }
    });

    it("rejects an unknown id", () => {
        expect(isSeamId("highcharts")).toBe(false);
    });
});

describe("seamTemplateFor", () => {
    it("rewrites the example-adapter import to the vendored local name", () => {
        const body = seamTemplateFor("echarts", "@local/echarts-adapter");
        expect(body).toContain('from "@local/echarts-adapter"');
        expect(body).not.toContain("chartlang-example-echarts-adapter");
    });

    it("emits a body byte-identical to SEAM_VARIANTS after substitution (all 6)", async () => {
        const variants = await loadVariants();
        for (const id of SEAM_IDS) {
            const variant = variants.find((v) => v.id === id);
            expect(variant, `missing SEAM_VARIANTS entry for ${id}`).toBeDefined();
            if (variant === undefined) {
                continue;
            }
            const localName = `@local/${id}-adapter`;
            const emitted = seamTemplateFor(id as SeamId, localName);
            const expected = variant.seamSource.split(variant.pkg).join(localName);
            expect(emitted).toBe(expected);
        }
    });
});
