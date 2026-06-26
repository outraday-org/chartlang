---
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-editor": minor
---

Make numeric `input.enum` execution complete (T4 Task 4 counterpart to Task 1's
core widening).

- **Runtime — `resolveInputs.matchesDescriptor`'s `enum` arm accepts a numeric
  override.** It previously type-gated an adapter override to `string`, so a
  numeric-enum override (`input.enum(21, [8, 21, 30])` overridden to `30`) was
  wrongly rejected with `input-coercion-failed` and fell back to the default.
  The arm now accepts a `string` OR `number` value that names a valid option.
  String-enum behaviour is byte-stable (a string value still checks string
  membership).
- **Compiler — `extractInputs` serialises numeric enum options.** The manifest
  extractor previously required `input.enum` options to be string literals, so
  a numeric dropdown emitted `input-default-not-literal` and failed to compile.
  A uniform numeric or uniform string options list now serialises; a mixed
  string/number list is still rejected (it cannot type-check). The numeric
  default already round-tripped.
- **Editor — the inputs form renders numeric enums and preserves their type.**
  `InputsFormOption.value` widens to `string | number`, the `<select>` value
  stringifies numeric current values so the control matches an option, and the
  change handler coerces the DOM string back to a number for numeric-enum
  options. Without this, a numeric override picked in the form was emitted as a
  string and silently discarded by the runtime's typed membership check.
