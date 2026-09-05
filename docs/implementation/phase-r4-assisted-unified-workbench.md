# R4 assisted unified roof workbench

Status: implementation in progress on Preview only.

## Outcome

An administrator completes the complete R4 measurement in one window. A clear
Norge i bilder orthophoto is the default human-facing surface. Original OSM,
Høydedata, proposed geometry, approved geometry, roof planes, skeleton edges
and obstacles are co-registered layers in the same viewport. Technical raster
views remain available but hidden by default.

The workflow is assisted rather than falsely autonomous: automatic proposals
reduce work, while a deterministic manual path can complete complex roofs when
source resolution or model confidence is insufficient.

## Non-negotiable data rules

1. Original source geometry and provenance are immutable.
2. Administrator edits create a separate versioned roof/eaves geometry in
   EPSG:25833.
3. Roof footprint and roof/eaves outline are distinct concepts.
4. A complex property may contain multiple roof masses.
5. Each mass may contain ridge, valley, hip and eave edges plus obstacles.
6. Every calculated plane retains its source, confidence and manual changes.
7. Low-confidence or invalid topology remains blocked in both UI and API.
8. Norge i bilder is used only under the approved user-triggered screenshot
   contract with `©norgeibilder.no`; no WMS/WMTS or model training.

## Guided interaction

The workbench exposes one active task and one primary action at a time:

1. **Address and source check** — verify the case-bound address, orthophoto
   source/vintage and coordinate registration. The visible ArcGIS camera
   extent, not the planned deep-link bounds, must georeference the captured
   pixels; when that extent cannot be verified, the photo remains contextual
   evidence and coordinate overlays are disabled.
2. **Roof outline** — adjust only incorrect roof/eaves vertices; add/remove a
   vertex, undo/redo, or reset to the source footprint.
3. **Roof masses and skeleton** — confirm separate roof masses and place the
   smallest useful set of ridge endpoints. The engine proposes valleys, hips
   and junctions; the administrator corrects only ambiguous edges.
4. **Slopes and planes** — fit DOM-minus-DTM samples per plane, exclude
   outliers, and calculate each non-overlapping 3D surface. A verified manual
   pitch from drawing or site remains available when the height grid is too
   coarse.
5. **Review** — show area and pitch on the corresponding visible plane, list
   only unresolved blockers, and unlock R4 approval only when all gates pass.

## Delivery slices

### R4-UW1: canonical assisted geometry

- versioned EPSG:25833 schema;
- source footprint, approved eaves outline, multiple roof masses;
- typed skeleton edges and obstacles;
- topology validation and stable issue codes;
- deterministic snapshot/hash compatibility.

### R4-UW2: unified client workbench

- orthophoto-first canvas;
- co-registered layer toggles;
- pointer/touch outline editing;
- two-click ridge/valley capture;
- guided stages, undo/reset and confidence/blocker feedback;
- responsive Admin Next visual language.

### R4-UW3: calculation adapters

- convert approved outline and skeleton to non-overlapping plane polygons;
- sample Høydedata separately per plane;
- fit pitch and calculate 3D area per plane;
- support L-shaped and multi-mass roofs without double counting;
- explicit manual-pitch fallback with provenance.

### R4-UW4: persistence and safety

- store manual edits as a new measurement revision;
- server-side revalidation of geometry and trusted source bindings;
- audit actor, timestamp, changed fields and reason;
- fail closed for low confidence, invalid topology or stale case/source state;
- preserve the existing no-send Preview boundary.

### R4-UW5: integration and UAT

- replace the expanding separate Preview blocks with the unified workbench;
- bind existing OSM, Norge i bilder and Høydedata results without rebuilding
  their providers;
- render the canonical R4 review drawer from the same snapshot;
- verify the final interaction against the agreed dark measurement design.

## Delivery order

1. Correct and test image-to-coordinate registration before judging or
   manually correcting the source outline.
2. Deliver an honest vertical slice of the unified Preview workbench using the
   real case image and immutable source outline.
3. Connect approved-outline edits and typed skeleton edges to the canonical
   assisted geometry contract.
4. Implement multi-mass plane fitting and the Høydedata/manual-pitch fallback.
5. Add revision persistence and server-side revalidation, then pass the three
   protected UAT archetypes before any Production activation decision.

## Acceptance matrix

All three archetypes must pass in protected Preview:

1. simple convex gable roof — automatic path;
2. L-shaped roof — corrected outline plus multiple masses/ridges;
3. compound roof with extensions — assisted skeleton plus per-plane review.

For every archetype:

- the address and exact roof are visually identifiable;
- outline handles map back to stable EPSG:25833 coordinates;
- original source and edited geometry remain distinguishable;
- plane polygons do not overlap or escape the approved roof outline;
- horizontal and 3D areas are deterministic and reproducible;
- low-confidence planes identify the exact required administrator action;
- no quote, customer notification or Production mutation occurs;
- focused tests, full typecheck, lint and regression suite pass.

Production activation is a separate explicit gate after protected Preview UAT.

## Live UAT decision — 2026-09-03

Multiple skeleton edges are a required Production capability, not an optional
polish item. The client and persisted draft already accept repeated ridge and
valley lines, and the deterministic subdivision core accepts multi-edge roof
graphs. The protected Preview calculation path must still be wired to that
subdivision result before a complex roof can be considered complete.

Required closure work:

1. Keep repeated ridge and valley capture in the same orthophoto canvas; add
   undo and explicit line deletion without resetting the active stage or zoom.
2. Add shared-node snapping and clear topology feedback for dangling,
   overlapping or crossing edges. Where Høydedata cannot infer a hip or
   junction safely, request only that missing edge from the administrator.
3. Invoke `subdivideAssistedManualRoofSurfacesV1` from the protected workbench
   calculation path, then return per-plane horizontal area, surface area,
   pitch, confidence and provenance to the unified review card.
4. Preserve the fallback ladder: automatic height-based result, assisted
   skeleton, verified manual pitch and finally the legacy manual calculation.
   A fallback must always state the method and reason; it may never be silent.
5. Pass live Preview UAT for one ridge, multiple ridges, an L-shaped
   ridge/valley roof and a compound roof before any Production GO decision.

The high-zoom ridge interaction fix is committed as `b937723`: stationary
pointer activation records endpoints, captured lines use a visible fixed pixel
stroke, and pending/final endpoint markers remain screen-stable. This closes
the interaction defect only; it does not by itself close multi-plane
calculation wiring.

Live Preview UAT on deployment `dpl_DdpHzgG351tnf84YCM7rgs26yLvS` confirmed
that a ridge remains visible after the second endpoint at 331% zoom and the
skeleton stage does not reset. Visual follow-up remains: reduce the apparent
ridge thickness at high CSS-transformed zoom so the line does not obscure roof
detail while keeping it clearly visible at 100%.
