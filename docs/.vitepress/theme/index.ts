// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import "./style.css";

// Extends (does not replace) the VitePress default theme. style.css remaps
// the default theme's --vp-* variables onto the shared brand tokens from
// ../../../brand/brand.css, so Nav, Sidebar, Content, and Search inherit the
// indigo + slate + emerald look without per-component overrides. The nav
// logo itself is wired via themeConfig.logo in ../config.ts.
const theme: Theme = {
    extends: DefaultTheme,
};

export default theme;
