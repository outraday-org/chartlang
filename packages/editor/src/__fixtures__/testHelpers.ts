// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { ChartlangLanguageService } from "@invinite-org/chartlang-language-service";

export type TestLanguageService = ChartlangLanguageService;

export const testCapabilities: Capabilities = {
    plots: new Set(["line"]),
    drawings: new Set(),
    alerts: new Set(),
    alertConditions: false,
    logs: false,
    inputs: new Set(["interval"]),
    intervals: [
        { value: "1m", label: "1 minute", group: "minute" },
        { value: "1D", label: "1 day", group: "daily" },
    ],
    multiTimeframe: false,
    subPanes: 0,
    symInfoFields: new Set(),
    maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
    maxLookback: 5000,
    maxTickHz: 10,
};

export function createTestLanguageService(
    overrides: Partial<TestLanguageService> = {},
): TestLanguageService {
    return Object.freeze({
        compileToDiagnostics: async () => [],
        getHoverDoc: () => null,
        getCompletions: () => [],
        getSignatureHelp: () => null,
        getDefinition: () => null,
        getAvailableIntervals: () => [],
        ...overrides,
    });
}

export async function waitFor(predicate: () => boolean): Promise<void> {
    const deadline = Date.now() + 1000;
    while (Date.now() < deadline) {
        if (predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("condition was not met before timeout");
}
