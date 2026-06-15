---
"@invinite-org/chartlang-editor": major
"@invinite-org/chartlang-language-service": patch
---

Make the editor package browser-safe to import by default. The editor no longer imports or constructs the language service at module load or default mount time; hover, completions, and linting are enabled only when a service is injected, while preview wiring stays independent.

**Breaking (editor):** `createChartlangEditor({ targetCapabilities })` and the returned `setCapabilities(...)` method (and the React `<ChartlangEditor targetCapabilities>` prop) are now no-ops. Create a language service with capabilities and inject it via `service`:

```ts
import { createChartlangEditor } from "@invinite-org/chartlang-editor";
import { createLanguageService } from "@invinite-org/chartlang-editor/language-service";

const editor = createChartlangEditor({
    parent,
    doc,
    service: createLanguageService({ targetCapabilities }),
});
```

The editor package also exposes explicit `./theme` and `./language-service` entry points so browser consumers can pick the surfaces they want without pulling the compiler into the main bundle.

The language-service change is purely internal: the compiler is now loaded via a dynamic `import("@invinite-org/chartlang-compiler")` inside `compileToDiagnostics`, so `createLanguageService(...)` no longer pulls the compiler graph at module load. Public signatures and behavior are unchanged.
