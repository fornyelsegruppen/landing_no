# PROD-8 owner UAT checklist — 2026-08-28

This checklist contains the remaining human-visible checks. Complete it only with synthetic data and owner-controlled email addresses. Do not open Payload, Neon or a terminal.

## A. Preview hotfix gate — required before Production hotfix

**Būsena: PASS 2026-08-28.** Savininkas atidarė sintetinę bylą `#4`, atnaujino puslapį ir patvirtino, kad bendras klaidos puslapis nepasirodė.

Open: `https://takfornyelse-staging.vercel.app/admin-v2`

1. Sign in to Preview.
2. Open one case that has not been marked reviewed.
3. Use the normal case review action once.
4. Refresh the page.

Expected: the action succeeds, the reviewed marker remains after refresh, and no generic error page appears.

Report: `Preview mark_reviewed PASS`.

STOP: any 4xx/5xx, missing case, lost marker after refresh or duplicate timeline event. Do not deploy the hotfix to Production.

## B. Manual contact recovery

**Būsena: PASS 2026-08-28.** Savininkas Preview sintetinėje byloje `#4` patvirtino visą grandinę: saugi kliento nuoroda atsidarė be administratoriaus sesijos priklausomybės, atskiras savininko valdomas `+uat` komunikacijos adresas išsaugotas, vienas ir tik vienas pasirinktas laiškas pristatytas tam adresui, dabartinis Takfornyelse logotipas rodomas, o panaudotas tokenas antrą kartą nebeveikė. Ankstesniame žingsnyje iš tos pačios bylos išsiųstas naujas sintetinis laiškas taip pat buvo pristatytas. Istoriniai kliento tapatybės ir dokumentų laukai nebuvo perrašomi; keičiama tik būsimos komunikacijos adreso reikšmė.

UAT metu užfiksuotos ir pataisytos dvi Preview kliūtys:

- `d3071fa` pašalino `/kontakt/{token}` iš lokalizavimo middleware, kad saugus kliento puslapis negrąžintų klaidingo 404;
- `3dd504f` paliko originalų patvirtintą laiško turinį ir priedus, bet recovery resend apvilko dabartiniu veikiančiu Takfornyelse šablonu, kad seni HTML logotipo adresai nebūtų kartojami.

Tiksliniai route, tokeno, šablono ir proxy testai, TypeScript bei lint buvo `PASS`; savininko matomas galutinis rezultatas sutapo su automatinių testų lūkesčiais.

Open: `https://takfornyelse-staging.vercel.app/admin-v2`

1. Use one synthetic case with a deliberately undeliverable email message.
2. In the case message section choose the manual-contact recovery action.
3. Copy the generated short Norwegian message and open its secure link in a private browser window.
4. Enter the same owner-controlled test email twice and submit once.
5. Check that exactly one copy of the previously missed message arrives.
6. In admin refresh the case, confirm the communication email and timeline/audit state.
7. Send the next synthetic message from the case and verify it uses the recovered email.

Expected: one message, one recovery record, no raw token shown as page text, and historical contract/customer identity is unchanged.

Report: `Manual recovery PASS` plus message category received.

STOP: duplicate delivery, a different case opens, historical identity changes, or the same link works a second time.

## C. Commercial negative paths

Use a new synthetic Preview case, not an existing real customer case.

1. Open the secure quote link and send one customer question. Confirm it appears in the case and no contract is signed.
2. Create a fresh version if needed, decline it using one structured reason and optional comment. Confirm decline classification appears in admin.
3. Use a separate fresh synthetic contract to submit a withdrawal/cancellation request. Confirm work is blocked for administrator review and no automatic final cancellation is performed.
4. Open an obviously altered or expired token URL.

Expected: question, decline and withdrawal are separate, auditable states; invalid token shows a safe error and no customer data.

Report: `Commercial negative paths PASS`.

STOP: an automatic destructive cancellation, wrong-case data, unsigned work order creation or invalid-token data disclosure.

## D. Worker and customer communication path

Admin case: `https://www.takfornyelse.as/admin-v2/cases/10`
Worker portal: `https://www.takfornyelse.as/user`

1. Confirm case #10 shows signed contract `K-10-V1` and scheduled work order `A-K-10-V1`.
2. As the assigned test worker, open only that assigned job on a phone-sized screen.
3. Progress in order: on the way → arrived → complete onsite precheck → ready/start → completed with required before/after evidence.
4. At every configured customer-notification step, check one email arrives and the timeline entry is clickable.
5. Verify a second click/reload does not duplicate the state change or email.
6. Submit completion documentation. In admin review and approve it.
7. Confirm invoice draft and warranty/completion documents appear under the same customer case.

Expected: valid state order, Europe/Oslo dates, one communication per event, no access to another worker’s job, and all documents grouped under case #10.

Report: `Worker E2E PASS` plus final work-order state and number of received emails.

STOP: wrong worker access, skipped mandatory precheck, duplicate email, missing documents, wrong amount or any real-customer recipient.

## Completion rule

PROD-8.2 and PROD-8.3 can be marked fully `PASS` only after all applicable sections above are completed and evidence is recorded. A code test or read-only database check does not replace these human-visible steps.
