import { defineConfig } from "vitepress";

const REPO_BLOB_URL = "https://github.com/outraday-org/chartlang/blob/main/";

export default defineConfig({
    title: "chartlang",
    description:
        "Open TypeScript eDSL for indicator, drawing, and alert scripts that run on any conforming chart adapter.",
    // GitHub Pages serves the site under /chartlang/; the Docs workflow
    // sets DOCS_BASE. Local dev and a future custom-domain deploy keep
    // the root base.
    base: process.env.DOCS_BASE ?? "/",
    ignoreDeadLinks: false,
    markdown: {
        html: false,
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
        nav: [
            { text: "Getting Started", link: "/getting-started/write-your-first-script" },
            { text: "Language", link: "/language/overview" },
            { text: "Spec", link: "/spec/grammar" },
            { text: "Primitives", link: "/primitives/ta/" },
            { text: "Adapters", link: "/adapters/contract" },
            { text: "Hosts", link: "/hosts/worker" },
            { text: "Reference", link: "/reference/glossary" },
        ],
        sidebar: {
            "/getting-started/": [
                {
                    text: "Getting Started",
                    items: [
                        {
                            text: "Write your first script",
                            link: "/getting-started/write-your-first-script",
                        },
                        {
                            text: "Embed in your chart",
                            link: "/getting-started/embed-in-our-chart",
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
                        { text: "Inputs", link: "/language/inputs" },
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
                        { text: "Bar state", link: "/primitives/barstate" },
                        { text: "Symbol info", link: "/primitives/syminfo" },
                        { text: "Timeframe", link: "/primitives/timeframe" },
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
                        {
                            text: "Lightweight Charts",
                            link: "/adapters/reference/lightweight-charts",
                        },
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
