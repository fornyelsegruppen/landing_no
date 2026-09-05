# RF complex-roof junction repair — 2026-09-05

## UAT finding

Priority: P1 calculation blocker. Stable baseline: `a7dcf6e`, private RF Preview.
Operator: Odins vei 2, Ås (1423), case TF-13, saved revision r25.

Reproduction: draw a ridge from the outline to an interior point; draw a second
ridge through its vicinity; add two valleys onto the ridges; calculate and
reload. The canvas reports two valleys, but calculation reports
`SKELETON_DANGLING_ENDPOINT`. The main card incorrectly says there are no blockers.

Screenshot evidence supplied by operator:

- `codex-clipboard-ae6a3077-20b9-429f-bd5e-e30855af2b11.png`
- `codex-clipboard-2caebd6b-08b8-44ad-b4c6-3f24d7c3b428.png`

Read-only inspection of the actual r25 rendered SVG confirmed that the first
ridge's interior endpoint is about 1.316 displayed CSS pixels from the second
ridge. Its other endpoints and both valleys touch their supporting edges to
floating-point precision. No screenshot dimensions were treated as survey data.

Expected: repeatable ridge/valley tools, visible magnetic junctions independent
of draw order, shared coordinates surviving editing and persistence, calculation
of valid closed surfaces, and precise visible guidance for incomplete geometry.

## Repaired paths

- Tool activation is idempotent. `Taisyti taškus · Esc` explicitly selects editing.
- Snap candidates use CSS distances and favor existing junctions and corners.
  Hover shows the snapped point and pending line.
- A new carrier previews and attaches nearby dangling tips within the same
  14 CSS pixel magnet radius. Existing connected and boundary-anchored nodes are
  not bulk-reinterpreted.
- Shared-node/carrier edits update connected branches atomically. Capture IDs
  remain unique after loading earlier drafts; duplicate edges are rejected.
- The serializer preserves already-valid snapped interior endpoints. It no
  longer applies a second independent boundary snap during save.
- Projected geometry uses metric floating-point tolerance, and area calculation
  uses a local origin. Explicit crossing junctions are split into shared edges.
- Sloping valley/hip classification uses the adjoining planes' perpendicular
  slopes instead of averages of distant vertices.
- Dangling endpoints are marked directly on the canvas. Current calculation
  blockers also appear on the main card; diagnostics do not disable safe retry.
- Whole-segment containment prevents lines crossing concave roof cutouts.
  Overlapping lines are rejected. Junctions on multiple continuous carriers
  retain those attachments or explain why a direct drag is not allowed.

## Verification and limits

Library regressions cover persisted L/T roofs with two ridges and two valleys,
cross roofs with four valleys, hip area, rotated projected boundaries, known
analytical surface areas, and genuine disconnected/crossing invalid geometry.

The dedicated local-only Playwright fixture uses real Chromium mouse hit testing,
1280×720 CSS viewport and DPR 1.5. It exercises drawing, zoom/pan, save/reload,
restored editing, and the actual height adapter; only database/account IO is
substituted. The control L roof has 108 m² horizontal area and
108 × sqrt(1.25) ≈ 120.748 m² surface area across five surfaces.

Final browser matrix: 2 scenarios passed (44.9 s), including carrier-first and
branch-first/carrier-later drawing, reverse-magnet preview and undo, repeated
tools, restored IDs, shared-node edits and successful recalculation. Exact
operator r25 coordinates are covered by helper regressions for both replay and
single-endpoint repair, with no remaining dangling endpoints.

Integrated validation: 30 Vitest files / 236 tests passed; changed-file ESLint
and TypeScript passed. Local Next production build completed using the Postgres
adapter with an intentionally unavailable loopback database and no migrations;
CMS fallback warnings were expected. The native Windows ARM SQLite adapter is
unavailable locally. Vercel Preview build is the deployment-environment check.

These controls verify calculation and editing behavior. They do not establish
survey accuracy for every actual building. Real results remain dependent on the
approved roof outline, correct ridge/valley placement and available DOM samples.
Insufficient samples, conflicting heights and incomplete topology remain blocked
or require review. Existing saved revisions remain immutable; corrections create
a new revision through the normal calculation action.

Release scope: protected Preview only. Production requires `PRODUCTION GO`.
