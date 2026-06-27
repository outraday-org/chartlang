import { defineConfig } from "vitepress";
import llmstxt from "vitepress-plugin-llms";

// The Examples section mirrors the live demo's catalogue. Importing
// DEMO_SCRIPTS (a pure type + string-constant module, no React) keeps the
// nav tab + sidebar in lockstep with the demo by construction; the
// per-example pages are emitted by `pnpm examples:generate`.
import {
    CATEGORY_LABELS,
    CATEGORY_ORDER,
    DEMO_SCRIPTS,
} from "../../apps/site/src/components/demo/scripts";

const REPO_BLOB_URL = "https://github.com/outraday-org/chartlang/blob/main/";

// Custom theme lives at ./theme/index.ts — shared brand tokens with
// apps/site/ via ../../../brand/brand.css. Logo, fonts, palette, and the
// Shiki code-block theme are aligned between the marketing site and the
// docs so they read as one product. See
// tasks/landing-site-netlify-deploy/5-docs-rebrand-and-netlify-configs.md.
export default defineConfig({
    title: "chartlang",
    description:
        "Open TypeScript eDSL for indicator, drawing, and alert scripts that run on any conforming chart adapter.",
    // The docs deploy to docs.chartlang.invinite.com at the root, so the
    // base defaults to "/". No CI workflow sets DOCS_BASE after the
    // custom-domain cutover (Task 6 removes the GitHub Pages workflow); the
    // env fallback stays for local flexibility and is harmless.
    base: process.env.DOCS_BASE ?? "/",
    head: [
        ["link", { rel: "icon", type: "image/svg+xml", href: "/logo.svg" }],
        ["link", { rel: "icon", type: "image/x-icon", href: "/logo.ico" }],
    ],
    ignoreDeadLinks: false,
    // Emits llms.txt (link index) + llms-full.txt (full corpus) and a raw
    // `.md` next to every built page, so LLMs and "copy as Markdown" tooling
    // can consume the docs. CLAUDE.md files are already excluded via
    // srcExclude; the generated primitives/ta + examples trees are real docs
    // and are intentionally included.
    vite: {
        // `injectLLMHint: false` — the plugin's per-page "Are you an LLM?"
        // hint is a `display:none` div, but our `markdown.html: false`
        // (below) escapes raw HTML, so the hint rendered as visible text on
        // every page. Disable it; `llms.txt` + the per-page `.md` files
        // (the parts LLMs actually consume) are still emitted.
        plugins: [llmstxt({ injectLLMHint: false })],
    },
    markdown: {
        html: false,
        // Dual Shiki theme: the dark theme matches apps/site's CodeBlock
        // (which is dark-only) so snippets read identically across the two
        // sites in dark mode; the light theme keeps code legible when the
        // docs are toggled to light mode (apps/site has no light mode).
        theme: { light: "github-light", dark: "github-dark-dimmed" },
        config(md) {
            const defaultRender =
                md.renderer.rules.link_open ??
                ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

            md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
                const hrefIndex = tokens[idx]?.attrIndex("href") ?? -1;
                if (hrefIndex >= 0) {
                    const attrs = tokens[idx]?.attrs;
                    const href = attrs?.[hrefIndex]?.[1];
                    if (href?.startsWith("../")) {
                        attrs[hrefIndex][1] = new URL(
                            href.replace(/^(\.\.\/)+/, ""),
                            REPO_BLOB_URL,
                        ).toString();
                    }
                }
                return defaultRender(tokens, idx, options, env, self);
            };
        },
    },
    srcExclude: ["**/CLAUDE.md"],
    themeConfig: {
        logo: { src: "/logo.svg", alt: "chartlang" },
        siteTitle: "chartlang",
        nav: [
            { text: "Getting Started", link: "/getting-started/write-your-first-script" },
            { text: "Examples", link: "/examples/" },
            { text: "Language", link: "/language/overview" },
            { text: "Spec", link: "/spec/grammar" },
            { text: "Primitives", link: "/primitives/ta/" },
            { text: "Adapters", link: "/adapters/gallery" },
            { text: "Hosts", link: "/hosts/worker" },
            { text: "Reference", link: "/reference/glossary" },
            { text: "Skills", link: "/skills/" },
            { text: "Converter", link: "/converter/" },
        ],
        sidebar: {
            // Grouped by the shared catalogue taxonomy (CATEGORY_ORDER),
            // mirroring the demo's "Browse examples" dialog: an Overview
            // entry followed by one collapsible section per non-empty
            // category. Empty categories are skipped (the catalogue fills
            // in incrementally across the population tasks).
            "/examples/": [
                {
                    text: "Examples",
                    items: [{ text: "Overview", link: "/examples/" }],
                },
                ...CATEGORY_ORDER.filter((category) =>
                    DEMO_SCRIPTS.some((script) => script.category === category),
                ).map((category) => ({
                    text: CATEGORY_LABELS[category],
                    collapsed: true,
                    items: DEMO_SCRIPTS.filter((script) => script.category === category).map(
                        (script) => ({ text: script.label, link: `/examples/${script.id}` }),
                    ),
                })),
            ],
            "/skills/": [
                {
                    text: "Skills",
                    items: [
                        { text: "Overview", link: "/skills/" },
                        { text: "chartlang-coding", link: "/skills/chartlang-coding" },
                        { text: "chartlang-setup", link: "/skills/chartlang-setup" },
                    ],
                },
            ],
            "/converter/": [
                {
                    text: "Pine Converter",
                    items: [
                        { text: "Overview", link: "/converter/" },
                        { text: "Usage", link: "/converter/usage" },
                        { text: "Supported surface", link: "/converter/supported" },
                        { text: "Rejects + manual rewrites", link: "/converter/rejects" },
                        { text: "Diagnostics reference", link: "/converter/diagnostics" },
                    ],
                },
            ],
            "/getting-started/": [
                {
                    text: "Getting Started",
                    items: [
                        {
                            text: "Write your first script",
                            link: "/getting-started/write-your-first-script",
                        },
                        {
                            text: "Start from a working app",
                            link: "/getting-started/react-starter",
                        },
                        {
                            text: "Embed in your chart",
                            link: "/getting-started/embed-in-our-chart",
                        },
                        {
                            text: "Run the site locally",
                            link: "/getting-started/run-the-site-locally",
                        },
                        {
                            text: "Write your first adapter",
                            link: "/getting-started/write-your-first-adapter",
                        },
                    ],
                },
            ],
            "/language/": [
                {
                    text: "Language",
                    items: [
                        { text: "Overview", link: "/language/overview" },
                        { text: "Series and indexing", link: "/language/series-and-indexing" },
                        { text: "Maps", link: "/language/state-map" },
                        { text: "Inputs", link: "/language/inputs" },
                        { text: "Time and sessions", link: "/language/time-and-sessions" },
                        { text: "Math", link: "/language/math" },
                        { text: "Strings", link: "/language/strings" },
                        { text: "Multi-timeframe", link: "/language/multi-timeframe" },
                        { text: "Alerts", link: "/language/alerts" },
                        { text: "Version pinning", link: "/language/version-pinning" },
                        { text: "Forbidden constructs", link: "/language/forbidden-constructs" },
                    ],
                },
            ],
            "/spec/": [
                {
                    text: "Spec — the frozen `apiVersion: 1` contract",
                    items: [
                        { text: "Grammar", link: "/spec/grammar" },
                        { text: "Semantics", link: "/spec/semantics" },
                        { text: "Manifest", link: "/spec/manifest" },
                        { text: "Emissions", link: "/spec/emissions" },
                        { text: "Versioning", link: "/spec/versioning" },
                        { text: "Pine migration", link: "/spec/pine-migration" },
                    ],
                },
            ],
            "/primitives/": [
                {
                    text: "Primitives",
                    items: [
                        { text: "TA", link: "/primitives/ta/" },
                        { text: "Draw", link: "/primitives/draw/" },
                        { text: "Math", link: "/primitives/math" },
                        { text: "Strings", link: "/primitives/str" },
                        { text: "Bar state", link: "/primitives/barstate" },
                        { text: "Symbol info", link: "/primitives/syminfo" },
                        { text: "Timeframe", link: "/primitives/timeframe" },
                        { text: "Time", link: "/primitives/time" },
                        { text: "Session", link: "/primitives/session" },
                    ],
                },
                {
                    text: "Plot",
                    items: [
                        { text: "plot", link: "/primitives/plot/plot" },
                        { text: "hline", link: "/primitives/plot/hline" },
                    ],
                },
                {
                    text: "Alert",
                    items: [{ text: "alert", link: "/primitives/alert/alert" }],
                },
                {
                    text: "Request",
                    items: [
                        { text: "Security", link: "/primitives/request/security" },
                        { text: "Lower timeframe", link: "/primitives/request/lowerTf" },
                    ],
                },
                {
                    text: "Define options",
                    items: [
                        { text: "Format", link: "/primitives/define/format" },
                        { text: "Max bars back", link: "/primitives/define/maxBarsBack" },
                        { text: "Precision", link: "/primitives/define/precision" },
                        {
                            text: "Required intervals",
                            link: "/primitives/define/requiresIntervals",
                        },
                        { text: "Scale", link: "/primitives/define/scale" },
                        { text: "Short name", link: "/primitives/define/shortName" },
                    ],
                },
                {
                    text: "Inputs",
                    items: [
                        { text: "Boolean", link: "/primitives/input/bool" },
                        { text: "Color", link: "/primitives/input/color" },
                        { text: "Enum", link: "/primitives/input/enum" },
                        { text: "External series", link: "/primitives/input/externalSeries" },
                        { text: "Float", link: "/primitives/input/float" },
                        { text: "Integer", link: "/primitives/input/int" },
                        { text: "Interval", link: "/primitives/input/interval" },
                        { text: "Price", link: "/primitives/input/price" },
                        { text: "Session", link: "/primitives/input/session" },
                        { text: "Source", link: "/primitives/input/source" },
                        { text: "String", link: "/primitives/input/string" },
                        { text: "Symbol", link: "/primitives/input/symbol" },
                        { text: "Time", link: "/primitives/input/time" },
                    ],
                },
                {
                    text: "State",
                    items: [
                        { text: "Boolean", link: "/primitives/state/bool" },
                        { text: "Float", link: "/primitives/state/float" },
                        { text: "Integer", link: "/primitives/state/int" },
                        { text: "String", link: "/primitives/state/string" },
                        { text: "Tick boolean", link: "/primitives/state/tick-bool" },
                        { text: "Tick float", link: "/primitives/state/tick-float" },
                        { text: "Tick integer", link: "/primitives/state/tick-int" },
                        { text: "Tick string", link: "/primitives/state/tick-string" },
                    ],
                },
            ],
            "/adapters/": [
                {
                    text: "Adapters",
                    items: [
                        { text: "Gallery", link: "/adapters/gallery" },
                        { text: "Overview", link: "/adapters/" },
                        { text: "Contract", link: "/adapters/contract" },
                        { text: "Capabilities", link: "/adapters/capabilities" },
                        { text: "Writing an adapter", link: "/adapters/writing-an-adapter" },
                        { text: "Plot overrides", link: "/adapters/plot-overrides" },
                        { text: "Conformance", link: "/adapters/conformance" },
                    ],
                },
                {
                    text: "Reference",
                    items: [
                        { text: "Canvas 2D", link: "/adapters/reference/canvas2d" },
                        {
                            text: "Lightweight Charts",
                            link: "/adapters/reference/lightweight-charts",
                        },
                        { text: "uPlot", link: "/adapters/reference/uplot" },
                        { text: "ECharts", link: "/adapters/reference/echarts" },
                        { text: "Konva", link: "/adapters/reference/konva" },
                    ],
                },
            ],
            "/hosts/": [
                {
                    text: "Hosts",
                    items: [
                        { text: "Worker", link: "/hosts/worker" },
                        { text: "QuickJS", link: "/hosts/quickjs" },
                        { text: "Writing a host", link: "/hosts/writing-a-host" },
                    ],
                },
            ],
            "/reference/": [
                {
                    text: "Reference",
                    items: [
                        { text: "Glossary", link: "/reference/glossary" },
                        { text: "FAQ", link: "/reference/faq" },
                    ],
                },
            ],
        },
        socialLinks: [{ icon: "github", link: "https://github.com/outraday-org/chartlang" }],
    },
});
