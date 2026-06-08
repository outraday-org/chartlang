// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import { createLanguageService } from "./createLanguageService";

const source = `
import { defineIndicator, input, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Golden",
    apiVersion: 1,
    inputs: { interval: input.interval("1D") },
    compute: ({ bar }) => {
        return ta.ema(bar.close, 20);
    },
});
`;

const capabilities: Capabilities = {
    plots: new Set(),
    drawings: new Set(),
    alerts: new Set(),
    alertConditions: false,
    logs: false,
    inputs: new Set(["interval"]),
    intervals: [{ value: "1D", label: "1 day", group: "daily" }],
    multiTimeframe: false,
    subPanes: 0,
    symInfoFields: new Set(),
    maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
    maxLookback: 100,
    maxTickHz: 10,
};

describe("language-service goldens", () => {
    it("matches the hover fixture", () => {
        const service = createLanguageService();
        const hover = service.getHoverDoc(source, source.indexOf("ta.ema") + 4);

        expect(hover).toMatchInlineSnapshot(`
          {
            "paramTable": [
              {
                "doc": "",
                "name": "source",
                "type": "Series<number>",
              },
              {
                "doc": "",
                "name": "length",
                "type": "number",
              },
              {
                "doc": "",
                "name": "opts",
                "type": "EmaOpts",
              },
            ],
            "summary": "The typed surface of the \`ta\` namespace. The runtime registers concrete
          implementations against this interface; scripts call it through the
          \`ta\` constant exported from \`@invinite-org/chartlang-core\`. Method: ta.ema.",
            "title": "ta.ema(source, length, opts?)",
          }
        `);
    });

    it("matches the interval completion fixture", () => {
        const service = createLanguageService({ targetCapabilities: capabilities });
        const completions = service.getCompletions(source, source.indexOf('"1D"') + 1);

        expect(completions).toMatchInlineSnapshot(`
          [
            {
              "detail": "1 day",
              "doc": {
                "summary": "Group: daily",
                "title": "1D",
              },
              "insertText": "1D",
              "kind": "enumMember",
              "label": "1D",
            },
          ]
        `);
    });
});
