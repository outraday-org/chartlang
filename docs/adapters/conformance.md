# Conformance suite

> **Phase:** Lands in Phase 1.
> **Cross-reference:** See PLAN.md §15.3.

How `@invinite-org/chartlang-conformance` certifies an adapter:
fixture-driven scenarios that replay a known candle stream + script
pair, compare emissions against golden output, and publish a
machine-readable report. Passing the suite is what lets an adapter
claim a chartlang version.

## Publishing your conformance report

Run the conformance suite in the adapter repo, then generate the public
report from the same passing run:

```sh
pnpm conformance:report
```

The command writes two files at the adapter package root:
`CONFORMANCE.md` for reviewers and `conformance-report.json` for tooling.
Check both into the adapter's own repository. The Markdown report lists
every scenario by id, title, and pass/fail status; failed scenarios include
the assertion messages needed to investigate or intentionally re-pin a
changed result.

Projects can drift-gate the checked-in pair with:

```sh
pnpm tsx scripts/run-conformance.ts --report --check
```
