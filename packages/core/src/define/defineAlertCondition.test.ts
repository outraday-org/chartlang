// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it, vi } from "vitest";

import { input } from "../input";
import { defineAlertCondition } from "./defineAlertCondition";

describe("defineAlertCondition", () => {
    it("returns a frozen CompiledScriptObject with alert-condition manifest metadata", () => {
        const compute = vi.fn();
        const script = defineAlertCondition({
            name: "cross",
            apiVersion: 1,
            conditions: {
                up: {
                    title: "Up",
                    description: "Close crossed up",
                    defaultMessage: "{{ticker}} up",
                },
            },
            compute,
        });

        expect(Object.isFrozen(script)).toBe(true);
        expect(Object.isFrozen(script.manifest)).toBe(true);
        expect(script.manifest.kind).toBe("alertCondition");
        expect(script.manifest.capabilities).toEqual(["alertConditions"]);
        expect(script.manifest.alertConditions).toEqual([
            {
                id: "up",
                title: "Up",
                description: "Close crossed up",
                defaultMessage: "{{ticker}} up",
            },
        ]);
        expect(Object.isFrozen(script.manifest.alertConditions)).toBe(true);
        expect(Object.isFrozen(script.manifest.alertConditions?.[0])).toBe(true);
        expect(script.compute).toBe(compute);
    });

    it("uses provided input schema", () => {
        const inputs = { length: input.int(20) } as const;
        const script = defineAlertCondition({
            name: "cross",
            apiVersion: 1,
            inputs,
            conditions: {
                up: { title: "Up", description: "desc", defaultMessage: "msg" },
            },
            compute: () => {},
        });

        expect(script.manifest.inputs).toBe(inputs);
    });
});
