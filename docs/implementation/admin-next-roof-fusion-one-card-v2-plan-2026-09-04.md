# Roof Fusion One Card v2 plan

**Owner:** RF

**Status:** IN PROGRESS · Preview branch only

**Implementation:** Phases A–D implemented; Phase E and owner UAT remain gated

**Production:** untouched; no offer, pricing, customer, or Production write is
authorized by this plan

## Implementation checkpoint · 2026-09-04

Implemented in the isolated RF Preview branch:

- the state-driven `Objektas → Patikslinimas → Rezultatas` card;
- one disclosed address action that resolves the address and obtains one Norge
  orthophoto;
- direct pointer and keyboard building selection on that orthophoto;
- automatic height preparation only after building selection;
- one `Apskaičiuoti` action for CAS save, reload/hash proof, and calculation;
- authoritative calculated surface polygons with stable IDs, per-slope area,
  pitch, direction, confidence, and row-to-polygon highlighting;
- image-adjacent overlay opacity, thinner ridge lines, and a modal `Advanced`
  recovery drawer with the guarded legacy fallback;
- reducer, interaction, stale-response, detailed-result, route, and integration
  tests.

Still intentionally gated:

- immutable RF measurement approval and add-to-offer command (Phase E);
- a protected owner UAT Preview and any Production release decision (Phase F).

## 1. Decision

Preserve the verified Roof Fusion calculation, evidence, CAS, revision, and
fail-closed safety core, but replace the current long stacked page with one
state-driven work card.

The normal successful journey has four deliberate operator clicks, plus only
the annotation gestures genuinely required by the roof:

1. `Rasti adresą ir atverti ortofoto`;
2. click the correct building directly on the orthophoto;
3. `Apskaičiuoti`;
4. after reviewing the result, `Įkelti matavimą į pasiūlymą`.

There are no separate normal-path buttons for Norge capture, height data,
revision save, checksum reload, stage confirmation, or R4 confirmation. Those
remain explicit internal states of the single calculation action, not extra
operator chores.

`Advanced` is a closed drawer by default. It opens automatically only when a
normal-path prerequisite fails and shows the recovery actions in recommended
order. The legacy area-plus-pitch model is the last explicit fallback, never a
parallel default and never a silent replacement for a better result.

## 2. Why the current screen is not a real one-card flow

- Address search, building selection, Norge capture, height acquisition,
  annotation, persistence, and calculation are visually separated.
- The operator must scroll down, then return up, then search in `Advanced`.
- Four freely selectable technical stage tabs expose implementation order
  instead of guiding the operator.
- `Išsaugoti ir patvirtinti reviziją` and `Apskaičiuoti nuolydžius` are separate
  clicks even though they form one safe transaction from the operator's view.
- `Gauti tikrą stogo paviršių` appears as a second calculation path even when
  automatic Kartverket preparation already ran.
- Candidate polygons are currently display-only: the SVG polygons have no
  selection interaction, so the visible building cannot be chosen by clicking
  it.
- `Advanced` is a tall permanent right column. It increases page length and
  competes with the main action.
- The final view exposes technical blockers and a disabled approval button
  instead of showing a clear, visual, per-slope measurement result.

## 3. Proven market patterns to adopt

The proposed interaction does not copy another product's visual design. It
adopts four established workflow patterns:

- address-first ordering and a short path from property to report;
- one visual model where selecting a roof facet reveals its measurements;
- a report that exposes area, pitch, roof facets, edges, diagram, and evidence;
- a separate explicit conversion from a reviewed measurement into an estimate
  or proposal.

Reference evidence:

- [Roofr Measurements](https://roofr.com/qxo/measurements) describes an
  address-first report order, detailed length/area/pitch/direction output, and a
  one-click report-to-proposal conversion.
- [HOVER Measurements mode](https://help.hover.to/en/articles/13153983-introducing-measurements-mode)
  keeps measurements in one workspace, lets the user click a facet for its
  values, and exports to estimating without manual re-entry.
- [GAF QuickMeasure](https://www.gaf.com/en-us/resources/business-services/quickmeasure)
  groups high-resolution imagery, complete measurements, editable 3D, and
  estimating outputs; its
  [sample report](https://www.gaf.com/en-us/document-library/documents/brochures-%26-literature/quick_measure_sample_roof_report.pdf)
  separates overview, top view, lengths, pitches, areas, and summary.
- [Roofr's unified report/version view](https://roofr.com/product-blog/the-new-roofr-measurement-reports-page-ready-to-level-up-your-measurements)
  reinforces keeping report versions together under the job address instead of
  creating disconnected duplicate results.

For RF this means: the image is the workspace, the result is linked to the same
geometry, revisions remain immutable, and the proposal receives a reviewed
measurement reference rather than copied UI numbers.

## 4. One Card v2 state machine

| State             | What the operator sees                             | Primary transition                                      |
| ----------------- | -------------------------------------------------- | ------------------------------------------------------- |
| `address`         | one address field and one CTA                      | explicit `Rasti adresą ir atverti ortofoto`             |
| `acquiring`       | one progress sequence inside the same card         | resolve address, capture ortho, project candidates      |
| `building_select` | Norge orthophoto with every candidate footprint    | click one polygon; no extra Continue button             |
| `annotate`        | same image, selected outline, only needed tools    | draw/correct only missing geometry, then `Apskaičiuoti` |
| `calculating`     | `Išsaugoma → tikrinama → skaičiuojama`             | one idempotent orchestration, no extra clicks           |
| `result`          | image/diagram plus total and per-slope results     | `Keisti žymėjimą` or `Įkelti matavimą į pasiūlymą`      |
| `adding_to_offer` | target proposal and immutable measurement identity | exact-hash server command                               |
| `offer_added`     | success, measurement ID, proposal ID/link          | end state; nothing sent to the customer                 |

`blocked` is not a dead-end page. It returns to `annotate`, preserves the
operator's work, highlights the exact missing item, and opens the recovery
drawer only when needed.

The stage indicator is informational, not a row of freely navigable tabs:
`1 Objektas → 2 Patikslinimas → 3 Rezultatas`.

## 5. Address, licensed image, and building selection

### Combined first click

The first button must honestly disclose that it does two things:

> **Rasti adresą ir atverti ortofoto**  
> Bus gautas vienas licencijuotas Norge i bilder vaizdas šiai bylai.

This click is the explicit provider action. Merely typing in the field must not
contact the paid/licensed provider. The server sequence is:

1. validate and resolve the address;
2. bind the request to case/lead, actor, and idempotency key;
3. obtain one Norge capture centered on the resolved address;
4. project all nearby OSM candidates into that same trusted extent;
5. show the orthophoto selection state.

Double-click, reload, and safe retry must not create duplicate paid captures.
If the Norge contract requires a separate consent action, keep one additional
explicit capture step; do not hide a contractual/provider charge behind a
generic free search label.

### Direct candidate selection

- Every candidate is a real pointer/keyboard target in the same coordinate
  transform as the orthophoto.
- Clicking a polygon is the explicit building choice and immediately advances
  to annotation; no second confirmation button is needed.
- The selected contour receives a clear outline/fill and a short address/distance
  label. Other candidates remain visible but quiet.
- `Keisti pastatą` returns to the selection state.
- Changing candidate invalidates capture-derived binding, height result, draft,
  annotations, and calculation. Late responses for the prior candidate are
  ignored.
- A compact accessible list remains available as a keyboard fallback, but the
  current `<select>` is not the primary interaction.

After a valid candidate click, free Kartverket DOM + DTM preparation starts in
the background. Its progress belongs in the main card, not `Advanced`.

## 6. Annotation experience

The system should first show its best suggestion and ask the operator only for
what it cannot determine safely.

### Normal simple roof

- The verified outline is already visible.
- If automatic flat, mono, or gable segmentation passes, no manual line is
  required.
- The operator reviews the overlay and can click `Apskaičiuoti` immediately.

### Assisted roof

- The system highlights the exact missing item: for example `Pažymėkite kraigą`
  or `Pažymėkite slėnį`.
- Line type is selected once and remains active for multiple lines; this supports
  compound roofs without repeating `+ Kraigas` before every segment.
- Supported typed lines are ridge, valley, hip, eave, and pitch break where the
  engine contract supports them.
- Multiple ridges and disconnected roof masses are first-class, not squeezed
  into a two-plane-only assumption.

### Agreed interaction details

- saved ridge/valley line: screen-stable `1.5 px`; pending line: `1.5 px`;
- small screen-stable endpoints with the larger invisible hit target retained;
- boundary magnet/tolerance: a near-edge endpoint snaps to the approved contour;
- a far outside endpoint is rejected with a clear reason;
- Google-Maps-like pan/zoom: normal wheel scrolls the page, Ctrl/Cmd + wheel
  zooms, and dragging an empty zoomed canvas pans;
- overlay opacity control stays next to the image because it is a frequent visual
  check, not a buried technical setting;
- undo, clear current line, fit, and `Keisti pastatą` are secondary actions;
- source outline stays immutable; every correction is a separate approved
  revision geometry.

The UI should infer complexity first. `Sudėtingas stogas` is an override/tool
reveal, not a mandatory question for every roof.

## 7. One `Apskaičiuoti` action

One operator click orchestrates the existing safe steps:

1. build the canonical draft;
2. CAS-save a new revision;
3. reload and verify the exact draft hash;
4. verify address, candidate, capture ID/hash/timestamp, georeference, and height
   surface identity;
5. run the correct automatic or assisted adapter;
6. persist an append-only Roof Fusion snapshot;
7. return a versioned result projection tied to that snapshot.

Any failure keeps the annotations, does not advance to result, does not write to
pricing, and gives one safe retry or the next recovery action. The internal
steps remain visible as progress, but are not separate buttons.

## 8. Result card contract

The canonical snapshot already contains most required calculation data. The
workbench response must stop flattening it to four aggregate metrics and instead
return a versioned `R4ResultV1` projection containing:

- snapshot ID, revision, draft hash, result hash, and state;
- stable `surfaceId` and `roofMassId` for every slope;
- gross/net horizontal and true surface area per slope;
- pitch value/range, azimuth/direction, and confidence/rationale per slope;
- source references and evidence identity per slope;
- typed ridge/valley/hip/eave edges and their defined lengths;
- explicit perimeter semantics;
- aggregate horizontal, gross surface, net surface, weighted pitch, perimeter,
  gutters/eaves, confidence, and gates.

The result screen uses the agreed R4 pattern:

- the roof diagram/image remains dominant;
- every computed slope is labeled on the diagram;
- selecting a slope row highlights the same polygon on the image;
- the right side shows total area, pitch, perimeter, and all slope rows grouped
  by roof mass;
- it supports any number of slopes, not only four `S1–S4` cards;
- gross versus net area and openings are explicit;
- source/evidence/history stays available in a compact expandable section;
- warnings are attached to the affected slope instead of presented as one vague
  global blocker.

## 9. Add to offer

This is a separate explicit action after visual review. It must not be combined
with calculation and must never send or approve a customer proposal.

The safe implementation order is:

1. save the exact RF snapshot;
2. review/approve it with CAS and idempotency against the exact hash;
3. create a new immutable `roof_fusion_snapshot` measurement version;
4. pass only its measurement ID, version, snapshot ID/hash, and input hash into
   the existing pricing/offer pipeline;
5. reject stale, blocked, changed, or Preview-only results server-side.

For a high-confidence result with no blockers, clicking
`Įkelti matavimą į pasiūlymą` can itself be the explicit review/acceptance. A
low-confidence or overridden result requires an exception acknowledgement and
reason before the same server command becomes available.

Success copy:

> **Matavimas sėkmingai užfiksuotas ir įkeltas į pasiūlymą.**  
> Matavimas RF-… · Pasiūlymas … · `Atverti pasiūlymą`

## 10. Advanced recovery drawer

`Advanced` must open as an overlay/drawer and must not lengthen the normal page.
When opened automatically after a failure, it shows only the relevant next
actions, ordered by best expected result:

1. retry or repair source/address/capture binding;
2. reload and verify revision/CAS evidence;
3. correct the outline;
4. add typed ridges, valleys, hips, openings, or multiple roof masses;
5. use the old horizontal-area-plus-manual-pitch fallback with explicit reason;
6. stop and require an onsite/manual survey when evidence is not defensible.

The full technical source IDs, hashes, layers, debug states, and capture refresh
remain available below the guided recovery section, never mixed into the normal
task.

Fallback is never silent. A lower-tier result is a separate reviewed proposal;
it cannot overwrite or masquerade as a higher-tier RF result.

## 11. Desktop and mobile layout rule

The card replaces content between states; completed stages do not stay stacked
above or below the current stage.

Desktop:

- compact header/status line;
- dominant image/diagram on the left;
- only the current task or result summary on the right;
- one sticky card footer with one primary CTA and at most two secondary actions;
- `Advanced` overlays from the right instead of creating a long permanent rail.

Mobile:

- the same state machine in one column;
- image first, current controls second, sticky primary CTA;
- natural page scroll is allowed, but no historical stage panels or permanent
  Advanced stack are rendered.

## 12. Existing RF pieces to reuse

- zoom/pan, vertex editing, typed lines, snapping, and undo from the unified
  workbench;
- WGS84-to-ortho candidate projection;
- Norge authorization, idempotency, attribution, and source evidence;
- persistent workbench CAS save/reload/hash verification;
- automatic and assisted height adapters;
- append-only `roof-snapshot.v1` storage and canonical repository commands;
- guarded legacy manual pitch fallback;
- R4 read adapter and measurement review visual language.

The existing separate AI proposal action is not reused as the RF offer bridge;
it is not bound to the exact workbench draft/result hash.

## 13. Implementation sequence after the current baseline test

### Phase A — controller and compact shell

- Introduce a pure `OneCardState` reducer and transition tests.
- Replace free stage tabs with the three-state informational indicator.
- Render only current-state content and move `Advanced` into a drawer.
- No provider, calculation, offer, or Production behavior change yet.

### Phase B — address, ortho, and clickable candidates

- Combine explicit address search + one disclosed Norge capture.
- Project every candidate into the trusted ortho extent.
- Add polygon hit-testing, keyboard selection, stale-response protection, and
  candidate invalidation tests.
- Start free height preparation after valid candidate selection.

### Phase C — annotation and one-click calculation

- Keep simple roofs zero-annotation when confidence gates pass.
- Support persistent multi-line typed skeleton tools for complex roofs.
- Orchestrate save, reload proof, validation, adapter, and snapshot under one
  `Apskaičiuoti` action.

### Phase D — full R4 result projection and UI

- Define `R4ResultV1` with stable surface/mass identity and per-slope evidence.
- Return all slopes, not four flattened cards.
- Link slope rows to diagram overlays and show exact aggregate invariants.

### Phase E — immutable measurement and offer bridge

- Add hash-bound review/approval.
- Add an immutable RF-to-measurement projection.
- Add idempotent `Įkelti matavimą į pasiūlymą` without approve/send/customer
  side effects.

### Phase F — UAT and release gate

- Run the full automated matrix and owner UAT in a new protected Preview.
- Production remains disabled until a separate explicit `PRODUCTION GO`.

## 14. Minimum test matrix

- flat rectangle;
- mono-pitch;
- convex gable with two faces and shared ridge;
- hip roof with ridge, four hips, and junction continuity;
- concave L-roof with valley;
- compound roof with multiple ridges and order-invariant stable IDs;
- connected and detached roof masses;
- openings with gross/net area and strict owner;
- more than four result slopes;
- sparse/noisy/high-RMSE height surfaces;
- invalid outside, dangling, crossing, or ambiguous skeleton lines;
- candidate switch during capture and height requests;
- capture refresh while the workbench is active;
- duplicate click, retry, provider timeout, and partial source failure;
- CAS conflict, stale hash, reload determinism, and dirty-result invalidation;
- legacy min/max bounds, evidence, reason, and protected-result override;
- blocked/review-only result rejected by the offer bridge;
- idempotent add-to-offer retry and exact measurement/snapshot evidence retained;
- proof that Preview cannot invoke Production, pricing, customer notification,
  proposal approval, issue, or send actions.

## 15. Acceptance criteria

- The successful simple-roof path needs exactly four deliberate operator clicks
  after typing the address.
- No normal-path action is hidden below `Advanced`.
- No completed stage remains stacked on the page.
- The correct building can be selected directly on the Norge orthophoto.
- A building click is visibly reflected and can be undone with `Keisti pastatą`.
- Free height preparation is automatic and visible after selection.
- The system asks for annotations only when confidence/topology requires them.
- Multiple ridges and complex masses can be represented without a two-plane
  assumption.
- One `Apskaičiuoti` click performs save, proof, calculation, and snapshot
  persistence without losing operator work on failure.
- Result totals equal the sum of the visible per-slope values under explicit
  gross/net/perimeter definitions.
- The visual result is close to the agreed R4 reference and supports any number
  of slopes.
- `Advanced` is a closed drawer in the successful path and a guided recovery
  ladder on failure.
- The old manual pitch method remains available only as an explicit reviewed
  fallback.
- Add-to-offer uses an immutable persisted measurement identity, never raw
  client metrics.
- Success explicitly says that the measurement was recorded and added to the
  named proposal; nothing is sent to the customer.

## 16. Start condition

Do not implement this plan during the current planning step.

Start Phase A only after:

1. the current RF baseline calculation test is closed and its known findings are
   recorded;
2. the owner accepts this One Card v2 interaction contract;
3. the combined first-click Norge disclosure is confirmed compatible with the
   provider contract;
4. work continues on the isolated RF branch/Preview with Production untouched.
