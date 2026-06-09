// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import * as snapshotModule from "./snapshot";
import type { StateSnapshot, StateStoreKey, StreamSnapshot } from "./snapshot";

describe("state snapshot type module", () => {
    it("has no runtime surface", () => {
        let snapshot: StateSnapshot | undefined;
        let key: StateStoreKey | undefined;
        let stream: StreamSnapshot | undefined;

        expect(Object.keys(snapshotModule)).toEqual([]);
        expect(snapshot).toBeUndefined();
        expect(key).toBeUndefined();
        expect(stream).toBeUndefined();
    });
});
