// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["scripts/**/*.test.ts"],
        exclude: ["**/node_modules/**", "**/dist/**"],
    },
});
