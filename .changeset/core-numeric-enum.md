---
"@invinite-org/chartlang-core": minor
---

Widen `input.enum` from `T extends string` to `T extends string | number`, so a
dropdown can be backed by numeric options (`input.enum(21, [8, 21, 30, 50, 100])`)
in addition to string options. The `EnumDescriptor` generic bound and the
`InputDescriptor` enum union member widen to match; the string form is unchanged.
This is additive — existing string-enum callers and goldens are untouched. The
compiler's ambient core shim mirrors the widened signature in lockstep.
