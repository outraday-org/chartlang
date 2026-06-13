---
"@invinite-org/chartlang-language-service": minor
"@invinite-org/chartlang-editor": patch
---

Language service understands indicator-composition hovers, output-name
+ override-key completions, and surfaces the new `dep-*` diagnostics
inline. Hover on `<binding>.output(...)` lists the producer's titled
outputs; hover on `<binding>.withInputs({...})` lists the producer's
input schema with kinds + defaults. Completion fires for output titles
inside `<binding>.output("|")` and for override keys inside
`<binding>.withInputs({ |})`. Best-effort go-to-definition for
`.output("title")` navigates to the producer's matching `plot(value,
{ title })` call when the producer is a same-file `defineIndicator`;
cross-file and unresolvable cases fall back to `null`. Editor: no
public API change — new behaviour flows through the existing
`completionExtension` / `hoverExtension` / `linterExtension` wiring.
