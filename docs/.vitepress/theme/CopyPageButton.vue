<!-- Copyright (c) 2026 Invinite. Licensed under the MIT License. -->
<!-- See the LICENSE file in the repo root for full license text. -->

<!--
  "Copy page" control rendered in the doc header via the doc-before slot in
  index.ts. It consumes the raw `.md` that vitepress-plugin-llms emits next to
  every built page (see ../config.ts). The plugin rewrites a source
  `<dir>/index.md` to `<dir>.md` and does NOT emit one for the home page, so we
  derive the target from page.relativePath and hide the control where no `.md`
  exists.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useData, withBase } from "vitepress";

const { page, frontmatter } = useData();

// `examples/index.md` -> `examples.md`, `primitives/ta/index.md` ->
// `primitives/ta.md`, leaf pages unchanged. Home (`index.md`) has no emitted
// `.md`, so `show` gates the control off there.
const mdHref = computed(() => {
    const slug = page.value.relativePath.replace(/\.md$/, "").replace(/(^|\/)index$/, "");
    return withBase(`/${slug}.md`);
});

const show = computed(
    () => page.value.relativePath !== "index.md" && frontmatter.value.layout !== "home",
);

const open = ref(false);
const copied = ref(false);

async function copy() {
    open.value = false;
    try {
        const res = await fetch(mdHref.value);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await navigator.clipboard.writeText(await res.text());
        copied.value = true;
        window.setTimeout(() => {
            copied.value = false;
        }, 2000);
    } catch {
        // Fall back to opening the raw markdown so the user can copy manually.
        window.open(mdHref.value, "_blank", "noopener");
    }
}

function onDocumentClick(event: MouseEvent) {
    if (!(event.target as HTMLElement).closest(".copy-page")) open.value = false;
}

onMounted(() => document.addEventListener("click", onDocumentClick));
onBeforeUnmount(() => document.removeEventListener("click", onDocumentClick));
</script>

<template>
    <div v-if="show" class="copy-page">
        <button
            type="button"
            class="copy-page-main"
            :aria-label="copied ? 'Copied' : 'Copy page as Markdown'"
            @click="copy"
        >
            {{ copied ? "Copied!" : "Copy page" }}
        </button>
        <button
            type="button"
            class="copy-page-caret"
            aria-label="More Markdown options"
            :aria-expanded="open"
            @click="open = !open"
        >
            ▾
        </button>
        <div v-if="open" class="copy-page-menu" role="menu">
            <button type="button" role="menuitem" @click="copy">Copy as Markdown</button>
            <a :href="mdHref" target="_blank" rel="noopener" role="menuitem" @click="open = false">
                View as Markdown
            </a>
        </div>
    </div>
</template>

<style scoped>
.copy-page {
    position: relative;
    display: inline-flex;
    align-items: stretch;
    margin-bottom: 1.25rem;
    border: 1px solid var(--vp-c-divider);
    border-radius: 8px;
    overflow: visible;
    font-size: 13px;
    font-weight: 500;
}
.copy-page-main,
.copy-page-caret {
    background: var(--vp-c-bg-soft);
    color: var(--vp-c-text-1);
    padding: 4px 12px;
    transition: background-color 0.2s;
}
.copy-page-main {
    border-right: 1px solid var(--vp-c-divider);
    border-top-left-radius: 7px;
    border-bottom-left-radius: 7px;
}
.copy-page-caret {
    padding: 4px 8px;
    border-top-right-radius: 7px;
    border-bottom-right-radius: 7px;
}
.copy-page-main:hover,
.copy-page-caret:hover {
    background: var(--vp-c-default-soft);
    color: var(--vp-c-brand-1);
}
.copy-page-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 10;
    min-width: 180px;
    display: flex;
    flex-direction: column;
    background: var(--vp-c-bg);
    border: 1px solid var(--vp-c-divider);
    border-radius: 8px;
    box-shadow: var(--vp-shadow-3);
    padding: 4px;
}
.copy-page-menu > * {
    text-align: left;
    padding: 6px 10px;
    border-radius: 6px;
    color: var(--vp-c-text-1);
    text-decoration: none;
}
.copy-page-menu > *:hover {
    background: var(--vp-c-default-soft);
    color: var(--vp-c-brand-1);
}
</style>
