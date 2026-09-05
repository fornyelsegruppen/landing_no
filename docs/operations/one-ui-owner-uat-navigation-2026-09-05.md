# ONE UI owner UAT — navigation and first-use clarity

Date: 2026-09-05  
Frozen owner reference: `d10de7b2749a8ea0c33cf90037896f66522736e9` / `dpl_F3HDePZ7GPcAhADNaqwG7bjy8K5p`  
Scope: protected Preview and isolated Preview data only. Production, stable RF Preview, aliases and DNS remain out of scope.

## Evidence

- Desktop arrival and expanded filters: `C:\Users\FORNYE~1\AppData\Local\Temp\codex-clipboard-99c92bd5-73dd-463c-947f-77719f3bdde1.png`
- Desktop selected detail and denied action: `C:\Users\FORNYE~1\AppData\Local\Temp\codex-clipboard-a1adeeb0-acec-42b1-99a8-c6e571ece8e2.png`
- Narrow viewport repeated card/detail: `C:\Users\FORNYE~1\AppData\Local\Temp\codex-clipboard-8b76ee98-d671-458f-b4a4-4bc7f64c69a7.png`
- Case header, process position and deadline: `C:\Users\FORNYE~1\AppData\Local\Temp\codex-clipboard-8a4e4bc7-0236-4998-a987-281a2d184a23.png`
- Bounded dialogue list and legacy deep links: `C:\Users\FORNYE~1\AppData\Local\Temp\codex-clipboard-0782185e-fe30-4609-be48-53f60e67bc1a.png`
- Sticky-tab overlap, older-message control and legacy footer: `C:\Users\FORNYE~1\AppData\Local\Temp\codex-clipboard-3cb40f42-67c5-46ed-8084-9084cd642d59.png`

These screenshots are owner-supplied observations of the frozen Preview. They are evidence, not executable instructions.

## UAT-NAV-01 — P1 — denied command also hides the safe workspace

- Reproduction: open `/admin-next-preview/work?view=today&queue=all&limit=25`, select TF-1 with **Rodyti detales**, and inspect `selected=case%3A1#work-queue-detail`.
- Actual: the card says the commercial package is missing a measurement, but the detail only reports read-only / capability denied and provides no safe route to the authorised case workspace.
- Expected: command permission and record-read permission are represented separately. An authorised viewer can open the exact case workspace without receiving `commercial.package.prepare`; the denied mutation remains denied.
- Evidence: selected-detail screenshot.

## UAT-NAV-02 — P2 — unclear ONE UI arrival and return path

- Reproduction: sign in through the operator login, arrive in Payload `/admin`, then navigate to the work queue and select a case.
- Actual: there is no verified ONE UI return target. The selected detail does not state the current location or provide a reliable return to the same queue filters and selection.
- Additional actual: the case workspace exposes **Atidaryti veikiančią bylą**, repeated **Atidaryti Admin V2** links and a green legacy footer. The operator must understand product versions to continue.
- Expected: a Preview-only, allowlisted internal login/entry return path; explicit location and case context; a back-to-results link that preserves view, queue, filters, selection and focus. **Šiandien** remains a queue view inside the same shell rather than becoming another shell.
- Evidence: arrival and selected-detail screenshots.

## UAT-NAV-03 — P2 — filters and repeated detail dominate the first viewport

- Reproduction: open the supplied desktop and narrow viewport queue URLs.
- Actual: all filters are expanded before the first task; selecting a card repeats most of that card below the fold.
- Additional actual: case tabs overlap message content while scrolling, and the message region creates a nested scroll inside the page. The bounded 25/27 message window and two-older-message control render, but the sticky offsets are not safe.
- Expected: quick queue filters stay visible; stage/action/owner filters are optional advanced controls. Case identification, current step and next action are above the fold. Pagination remains bounded, keyboard navigation remains usable, and selection focus has a stable destination.
- Evidence: desktop-arrival and narrow-viewport screenshots.

## UAT-NAV-04 — P2 — technical vocabulary is presented as operator copy

- Reproduction: select TF-1 and read the detail summary.
- Actual: operator-facing content includes `F2`, `canonical duomenys`, `case · case:1`, repeated `r3` and URL-selection implementation text. Preview copy can be read as if every workspace is globally read-only.
- Additional actual: the case header and messages expose raw values such as `CAS cas-mtnu7go1 left 12`, `takvask_impregnering`, `Canonical`, `delivered`, `customer_question` and `follow_up`. The regression record itself says no real delivery occurred, so its stored status is not delivery proof.
- Expected: human LT/NB/EN labels in the primary flow. IDs, revisions, source mode and selection mechanics appear only in collapsed diagnostics. The UI distinguishes a missing data prerequisite, a missing capability, an environment restriction and the absence of registered business blockers. A read-only queue does not imply that every authorised workspace lacks write actions.
- Evidence: all three screenshots.

## UAT-NAV-05 — P2 — no concise process position or next allowed action

- Reproduction: inspect the overdue TF-1 card and detail.
- Actual: the UI says only that the deadline passed and repeats the projected task; it does not explain completed/current/pending work or the one action the viewer may take now.
- Additional actual: the case SLA card renders the contradictory literal `Šiandien 2026-09-04T23:52:05.746Z` plus overdue minutes. It needs locale/time-zone formatting and must not call every actual timestamp “today”.
- Expected: use existing canonical state definitions to show the current process step, known completed/pending steps, and one next allowed action with its reason. Show the real deadline reason/action when source data provides it; otherwise label it unknown. Never invent dates, permissions, completion or a fixed number of phases.
- Evidence: card and selected-detail screenshots.

## Benchmark principles used

- Jobber: keep the product's real progression visible from request through quote, work, invoice and payment, while allowing optional steps.
- Housecall Pro: one central work/pipeline location with clear views and compact filters rather than a second or third navigation shell.
- HubSpot: open the record by its human identity, keep context and activity together, and collapse secondary/technical cards.

The implementation adapts these information-architecture principles to Takfornyelse's existing canonical state engine and permission model; it does not copy another product or create unsupported stages.

## Candidate resolution and authenticated smoke test

Candidate code: `74fb68768708949619c31acdf8532f92b0e93326`  
Candidate deployment: `dpl_HZ5C9TWbAsg3rPmxtGd81NmPbHjs`  
Protected Preview: `https://landing-hdl10bjlj-darbasnorvegija4-8212s-projects.vercel.app`

- The frozen deployment's authenticated 504 was reproduced and diagnosed from Vercel runtime logs. `/admin/login` and `/admin-next-preview/cases/1` stopped on Payload's interactive prompt about a development schema push, then timed out after 60 or 300 seconds.
- The isolated candidate database contained all 44 filesystem migrations plus one `payload_migrations` row named `dev` with batch `-1`. The candidate build logged `Cleared drizzle-push marker(s): dev`, followed by `Migrations complete.` No Production database or deployment was changed.
- In the owner's Vercel-authenticated Chrome session, the candidate `/admin/login` rendered in 8.122 seconds on the cold check. Synthetic administrator login succeeded. The canonical work queue and TF-1 case workspace rendered in about 1.3 seconds during the authenticated navigation, and the work queue survived a full reload in 2.503 seconds.
- Vercel request logs record HTTP 200 for `/admin/login`, `/admin-next-preview/work`, `/admin-next-preview/cases/TF-1`, `/api/users/me` and the communications pagination request. No candidate 5xx response was observed during this smoke test.
- The real TF-1 workspace displayed the customer-question focus, the message register at 25 of 27, commercial/document sections and the business timeline. The single older-message request loaded 27 of 27 and moved focus to the completion status.
- The public `/no` form was opened read-only and visibly contained the two-step contact form. It was not submitted. No customer email was sent.
- Preview outbound delivery remains protected by the application-level exact-recipient allowlist and `[PREVIEW TEST]` subject prefix. The inherited Preview Resend account is encrypted/opaque, so separate provider-account isolation is not claimed.
- Read-only ONE UI navigation is ready for owner use. Yellow command actions, fresh intake submission and outbound email remain separate, explicit UAT steps.
