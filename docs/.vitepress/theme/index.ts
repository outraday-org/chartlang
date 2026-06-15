// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { h } from "vue";
import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import CopyPageButton from "./CopyPageButton.vue";
import "./style.css";

// Extends (does not replace) the VitePress default theme. style.css remaps
// the default theme's --vp-* variables onto the shared brand tokens from
// ../../../brand/brand.css, so Nav, Sidebar, Content, and Search inherit the
// indigo + slate + emerald look without per-component overrides. The nav
// logo itself is wired via themeConfig.logo in ../config.ts.
//
// The doc-before slot renders CopyPageButton above each page's content; it
// copies / links the raw `.md` emitted by vitepress-plugin-llms (see
// ../config.ts) and hides itself on pages with no emitted markdown (home).
const theme: Theme = {
    extends: DefaultTheme,
    Layout: () => h(DefaultTheme.Layout, null, { "doc-before": () => h(CopyPageButton) }),
};

export default theme;
