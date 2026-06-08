// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { makeSymInfoView, type AdapterSymInfo } from "./symInfoView";

const PAYLOAD: AdapterSymInfo = {
    ticker: "DEMO",
    type: "equity",
    mintick: 0.01,
    currency: "USD",
    basecurrency: "USD",
    exchange: "CHARTLANG",
    timezone: "Etc/UTC",
    session: "regular",
    meta: {
        nested: { ok: true },
    },
};

describe("makeSymInfoView", () => {
    it("copies all enabled fields", () => {
        const view = makeSymInfoView(
            PAYLOAD,
            new Set([
                "ticker",
                "type",
                "mintick",
                "currency",
                "basecurrency",
                "exchange",
                "timezone",
                "session",
                "meta",
            ]),
        );

        expect(view).toEqual(PAYLOAD);
        expect(Object.isFrozen(view)).toBe(true);
        expect(Object.isFrozen(view.meta)).toBe(true);
        expect(view.meta).not.toBe(PAYLOAD.meta);
    });

    it("returns empty sentinels for disabled fields", () => {
        const view = makeSymInfoView(PAYLOAD, new Set(["ticker"]));

        expect(view.ticker).toBe("DEMO");
        expect(view.type).toBe("custom");
        expect(Number.isNaN(view.mintick)).toBe(true);
        expect(view.currency).toBe("");
        expect(view.basecurrency).toBe("");
        expect(view.exchange).toBe("");
        expect(view.timezone).toBe("");
        expect(view.session).toBe("");
        expect(view.meta).toEqual({});
        expect(Object.isFrozen(view.meta)).toBe(true);
    });

    it("keeps nested JSON values when meta is enabled", () => {
        const view = makeSymInfoView(PAYLOAD, new Set(["meta"]));

        expect(view.meta).toEqual({ nested: { ok: true } });
    });

    it("uses empty sentinels when enabled fields are absent from payload", () => {
        const view = makeSymInfoView(
            {},
            new Set([
                "ticker",
                "type",
                "mintick",
                "currency",
                "basecurrency",
                "exchange",
                "timezone",
                "session",
                "meta",
            ]),
        );

        expect(view.ticker).toBe("");
        expect(view.type).toBe("custom");
        expect(Number.isNaN(view.mintick)).toBe(true);
        expect(view.currency).toBe("");
        expect(view.basecurrency).toBe("");
        expect(view.exchange).toBe("");
        expect(view.timezone).toBe("");
        expect(view.session).toBe("");
        expect(view.meta).toEqual({});
        expect(Object.isFrozen(view.meta)).toBe(true);
    });
});
