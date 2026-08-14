---
"@invinite-org/chartlang-host-worker": minor
"@invinite-org/chartlang-host-quickjs": minor
---

Both hosts carry the exchange calendar on their `load` frame

`CreateWorkerHostOpts.sessionCalendar` and `CreateQuickJsHostOpts.sessionCalendar`
take `SessionCalendarDay[]` and forward them on the EXISTING `load` frame — no
new frame kind; a calendar is mount data, not a verb. The worker boot and the
QuickJS dispatcher pass the rows straight to `createScriptRunner`, which builds
the `lookup()` guest-side, because a method does not survive `structuredClone`
or a JSON membrane.

For host-quickjs this is the half that actually matters to a server-side alert:
the regenerated dispatcher bundle is what makes a guest script's
`session.isOpen` shut at the real early close. Omit the option and every frame,
and every emission, is byte-identical to before.
