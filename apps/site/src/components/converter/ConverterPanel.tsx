// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// SSR-safe wrapper for the converter playground, mirroring EmbeddedDemo:
// the heavy body (CodeMirror + the lazy compile/chart preview) is both
// lazy-loaded and gated behind a `mounted` flag so it never runs during
// the server render, where the editor and `/api/compile` fetch have no
// business executing. A static placeholder fills the SSR pass.

import { type ReactElement, Suspense, lazy, useEffect, useState } from "react";

const ConverterBody = lazy(() => import("./ConverterBody"));

function ConverterPlaceholder(): ReactElement {
    return (
        <div className="mt-10 flex min-h-[640px] items-center justify-center rounded-lg border border-border bg-muted/40 text-sm text-muted-foreground">
            Loading the converter…
        </div>
    );
}

/**
 * Converter playground section. Heads the `/converter` route and swaps in
 * the live body once mounted on the client.
 */
export function ConverterPanel(): ReactElement {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <section className="py-12">
            <h1 className="text-3xl font-bold text-foreground md:text-4xl">
                Pine Script → chartlang converter
            </h1>
            <p className="mt-4 max-w-2xl text-muted-foreground">
                Paste a Pine Script v6 drawing indicator on the left and watch it become an
                equivalent chartlang <code>.chart.ts</code> on the right — converted live in your
                browser. Diagnostics flag anything that can&apos;t be translated faithfully. Hit
                “Compile &amp; preview” to run the output through the real compiler and render it.
            </p>

            {mounted ? (
                <Suspense fallback={<ConverterPlaceholder />}>
                    <ConverterBody />
                </Suspense>
            ) : (
                <ConverterPlaceholder />
            )}
        </section>
    );
}
