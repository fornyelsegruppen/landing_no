# Assisted manual roof-surface subdivision v1

`subdivideAssistedManualRoofSurfacesV1` is the deterministic, server-domain boundary between administrator-approved plan geometry and roof geometry calculation. It has no persistence, network, pricing, UI, or deployment behavior.

## Input contract

- A valid, canonicalizable `AssistedManualRoofGeometryV1` in EPSG:25833.
- A complete `KartverketHeightSurfaceV1` Høydedata grid in EPSG:25833.
- Every internal face boundary must be explicit as a typed ridge, valley, or hip edge. Eave hints may annotate all or part of the approved mass boundary.
- Graph junctions must use one shared vertex ID. Crossing or overlapping edges are rejected; the subdivision does not create inferred junctions or missing edges.

## Output contract

`ready` returns closed surfaces, a canonical shared-edge table, per-face Høydedata plane fits, and strict opening ownership. Surface edge IDs always reference that shared-edge table. IDs, ordering, hashes, and numeric rounding are deterministic.

`review_required` returns no surfaces when an unsplit mass does not fit one stable plane. The caller must collect an explicit skeleton rather than treating an inferred split as approved.

`blocked` returns no surfaces for invalid source geometry, graph ambiguity, overlap, incomplete coverage, insufficient height samples, unstable per-face fitting, shared-edge height disagreement, or an opening that is not strictly inside exactly one surface. Every outcome includes stable issue codes, entity references, and an explanation.

The topology checks enforce non-self-intersecting input rings, non-overlapping mass and surface interiors, complete mass coverage within tolerance, at most two owners per shared edge, exactly two owners for every internal skeleton edge, and consistent fitted height at shared endpoints.

## Height-adapter boundary

The v1 height adapter is intentionally not wired to this module yet. Its current downstream obstacle model assigns each obstacle directly to a mass-level surface; after subdivision that association can be ambiguous. Integrating without first adding strict per-surface obstacle ownership would silently guess. A follow-up adapter revision should consume only a `ready` result and map both openings and obstacles through explicit surface ownership before calling geometry calculation.
