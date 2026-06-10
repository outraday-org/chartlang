// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { type ReactElement, useCallback, useEffect, useRef } from "react";

import { createChartlangEditor } from "../createChartlangEditor.js";
import type { ChartlangEditorOpts, ChartlangEditor as MountedChartlangEditor } from "../types.js";

/**
 * Props for the React CodeMirror chartlang editor wrapper.
 *
 * @since 0.4
 * @stable
 * @example
 *     const props: ChartlangEditorProps = { source: "const value = 1;" };
 *     void props;
 */
export type ChartlangEditorProps = Readonly<{
    source: string;
    onSourceChange?: (next: string) => void;
    targetCapabilities?: ChartlangEditorOpts["targetCapabilities"];
    onCompiled?: ChartlangEditorOpts["onCompiled"];
    className?: string;
}>;

/**
 * Mount the framework-agnostic CodeMirror editor inside a React component.
 *
 * @since 0.4
 * @stable
 * @example
 *     const element = <ChartlangEditor source="const value = 1;" />;
 *     void element;
 */
export function ChartlangEditor(props: ChartlangEditorProps): ReactElement {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const editorRef = useRef<MountedChartlangEditor | null>(null);
    const sourceRef = useRef(props.source);
    const targetCapabilitiesRef = useRef(props.targetCapabilities);
    const onSourceChangeRef = useRef(props.onSourceChange);

    targetCapabilitiesRef.current = props.targetCapabilities;
    onSourceChangeRef.current = props.onSourceChange;

    const setContainer = useCallback((node: HTMLDivElement | null): void => {
        if (node === null) {
            editorRef.current?.destroy();
            editorRef.current = null;
            containerRef.current = null;
            return;
        }
        containerRef.current = node;
        const editor = createChartlangEditor({
            doc: sourceRef.current,
            ...(targetCapabilitiesRef.current === undefined
                ? {}
                : { targetCapabilities: targetCapabilitiesRef.current }),
            onSourceChange: (next) => {
                sourceRef.current = next;
                onSourceChangeRef.current?.(next);
            },
            parent: node,
        });
        editorRef.current = editor;
    }, []);

    useEffect(() => {
        if (editorRef.current !== null && props.source !== sourceRef.current) {
            editorRef.current.setSource(props.source);
            sourceRef.current = props.source;
        }
    }, [props.source]);

    useEffect(() => {
        editorRef.current?.setCapabilities(props.targetCapabilities ?? null);
    }, [props.targetCapabilities]);

    return <div className={props.className} ref={setContainer} />;
}
