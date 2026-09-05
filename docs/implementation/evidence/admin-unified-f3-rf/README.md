# Admin Unified F3 — RF case binding and visual precision evidence

**Captured:** 2026-09-04  
**Surface:** protected local Preview fixtures  
**Production:** untouched  
**Data:** deterministic fixture data; the UI is rendered from the real ONE UI
React components, not a drawn mockup

The RF workbench evidence uses an existing repository roof image in place of a
licensed customer orthophoto. The case binding, controls, geometry overlay,
metrics, responsive layout and R4 drawer are the production-intended
components. No customer, pricing, offer or Production mutation ran.

## Verified behavior

- The case-bound RF surface displays one immutable case address and exact
  'case r12 · RF r7' binding; there is no free address input.
- Address correction is a separate action with an explicit stale-source
  consequence disclosure.
- The standalone UAT free address input is marked diagnostic-only and excluded
  from pricing and offers.
- At RF zoom 300 %, DOM values are inverse-scaled before the canvas transform:
  approved 0.5833 px, source 0.3333 px, ridge/valley 0.5 px. Their visible
  sizes therefore remain respectively 1.75 px, 1 px and 1.5 px.
- Vertices are 7 px visually (8 px selected) with a separate 26 px invisible
  hit target.
- R4 uses one Lucide icon language for horizontal area, roof area, average
  pitch and perimeter; textual labels remain.
- R4 mobile uses one bounded drawer scroll region. Its header scrolls away,
  while the action footer remains available, avoiding the previous 47 px
  content viewport.

## Files and checksums

| Evidence                               |        Size | SHA-256                                                            |
| -------------------------------------- | ----------: | ------------------------------------------------------------------ |
| 'rf-workbench-win150-100.png'          | 1920 × 1080 | 'e56310823210760365987d4da6862cb572fe926b8e165cbd8b3d1457a8bebfd3' |
| 'rf-workbench-win150-300.png'          | 1920 × 1080 | '4c94d72cb69d6e29164947e5b6544a223f2dcc2827cf26f02cabf6b633752266' |
| 'rf-canvas-win150-100.png'             |   837 × 440 | '01b1a0250fb5921c7b81135c8289ae3847a09ab105bc4c34c6519c75392dc3d4' |
| 'rf-canvas-win150-300.png'             |   837 × 440 | 'd0482d5e5ba75e7b97e001d44637f48285dc9c4df21a1a7ca58534897ca51c9b' |
| 'rf-workbench-mobile-375.png'          |   375 × 812 | '6a5215d9d0f403694cddb98fa384a7da022b5fb3cada1f55531aa00cf05a58cf' |
| 'rf-canvas-mobile-375.png'             |   317 × 167 | '0549afb4676da8d6459049c0ef17c7477e9fa232cce8c56c632068be5a4d9c6d' |
| 'r4-case-address-icons-1440.png'       |  1440 × 900 | '5458825b9d022ebc093b5761bb0f483ed52934b8de9ea60087f85fde2a2bedff' |
| 'r4-case-address-icons-mobile-375.png' |   375 × 812 | '01d1391ab3f176fd0ed2090fd495092efade8b6f2ef25c80f9ae5ea77c6aa0f8' |
| 'r4-metrics-mobile-375.png'            |   375 × 812 | '998c3fdbaad8603865fd2ee689791821b4fe92e43fc829eba615036892045b83' |
