// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Summary of the converter's `ConvertManifest`: script kind/name, the
// inputs it surfaced, the drawing kinds it emitted, and whether it needs a
// bar interval. The `requiresBarInterval` flag becomes an actionable hint
// when set but the bar-interval control is still empty.

import type { ConvertManifest } from "@invinite-org/chartlang-pine-converter";
import type { ReactElement } from "react";

/** Props for {@link ManifestSummary}. */
export type ManifestSummaryProps = Readonly<{
    manifest: ConvertManifest | null;
    barIntervalSet: boolean;
}>;

function listOrDash(values: readonly string[]): string {
    return values.length === 0 ? "—" : values.join(", ");
}

/**
 * Renders the manifest metadata as a definition list. When the manifest is
 * `null` (no output) a muted placeholder is shown instead.
 */
export function ManifestSummary(props: ManifestSummaryProps): ReactElement {
    const { manifest } = props;
    const needsInterval =
        manifest !== null && manifest.requiresBarInterval && !props.barIntervalSet;

    return (
        <div className="panel">
            <h3 className="panel-title">Manifest</h3>
            {manifest === null ? (
                <p className="alerts-empty">No manifest — conversion produced no output.</p>
            ) : (
                <dl className="manifest">
                    <div>
                        <dt>Kind</dt>
                        <dd>{manifest.kind}</dd>
                    </div>
                    <div>
                        <dt>Name</dt>
                        <dd>{manifest.name}</dd>
                    </div>
                    <div>
                        <dt>Inputs</dt>
                        <dd>{listOrDash(manifest.inputs)}</dd>
                    </div>
                    <div>
                        <dt>Drawing kinds</dt>
                        <dd>{listOrDash(manifest.drawingKindsUsed)}</dd>
                    </div>
                    <div>
                        <dt>Bar interval</dt>
                        <dd className={needsInterval ? "hint" : undefined}>
                            {needsInterval
                                ? "required — set a bar interval (ms) to resolve future bar anchors"
                                : manifest.requiresBarInterval
                                  ? "supplied"
                                  : "not required"}
                        </dd>
                    </div>
                </dl>
            )}
        </div>
    );
}
