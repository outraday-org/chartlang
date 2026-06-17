---
"@invinite-org/chartlang-pine-converter": minor
"@invinite-org/chartlang-cli": minor
---

Ship the converter CLI surface and finalize the programmatic API. Add
`convertFile(path, opts?)` to `@invinite-org/chartlang-pine-converter`: an async
file-system wrapper around `convert` that reads the input as UTF-8, threads
`ConvertOpts` through, and — when `opts.outPath` is set and the conversion
yields a non-null `output` — writes the converted `.chart.ts` to disk. File I/O
failures reject the promise (host-environment errors, distinct from converter
diagnostics). Adds the `ConvertFileOpts` type (`ConvertOpts & { outPath? }`).

Add the `chartlang pine-convert <input.pine>` subcommand to
`@invinite-org/chartlang-cli`, a thin in-process layer over `convertFile` + the
`@invinite-org/chartlang-pine-converter/diagnostics` formatters. Flags:
`--out <path>` (write to file, else stream to stdout), `--report` /
`--diagnostics-json` (human report to stderr vs JSON to stdout), `--strict`,
`--bar-interval <ms>`, `--bar-index-origin <ms>`. Exit codes: `0` success,
`1` error-severity diagnostics, `2` file I/O failure, `3` invalid CLI args.
