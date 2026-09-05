# Unified admin F1 visual evidence

Source-built, fail-closed visual evidence for the shared shell and component
contract. The routes return `404` unless `ADMIN_NEXT_VISUAL_FIXTURE=true`, and
they always return `404` when `NODE_ENV=production`.

| Capture | Viewport | Contract |
|---|---:|---|
| `unified-today-375.png` | 375×812 | Compact header, own-row search and fixed navigation with four destinations plus More. |
| `unified-today-768.png` | 768×1024 | Tablet header without the former search/control breakpoint collision. |
| `unified-today-1024.png` | 1024×900 | First desktop breakpoint with sidebar navigation and no mobile navigation. |
| `unified-today-1440.png` | 1440×1000 | Wide desktop shell with inline search and account control. |
| `unified-case-375.png` | 375×812 | Compact current-stage summary; the six-stage path is available through an accessible disclosure without horizontal scrolling. |
| `unified-case-768.png` | 768×1024 | Six stages in a 3×2 tablet grid with one current step. |
| `unified-case-1024.png` | 1024×900 | Desktop case layout with a 3×2 stage grid and no shell collision. |
| `unified-case-1440.png` | 1440×1000 | Wide case layout with all six stages in one row. |
| `component-catalog-375.png` | 375×812 | Compact semantic states, touch targets and no horizontal overflow. |
| `component-catalog-768.png` | 768×1024 | Tablet wrapping and fixed-navigation content reservation. |
| `component-catalog-1024.png` | 1024×900 | Desktop component semantics at the sidebar breakpoint. |
| `component-catalog-1440.png` | 1440×1000 | Wide semantic status, owner, due, blocker, version, sync and async states. |
| `mobile-more-375.png` | 375×812 | Focus-managed mobile access to SEO and all administrative destinations. |
| `mobile-more-768.png` | 768×1024 | Tablet More dialog clears the safe-area-aware fixed navigation. |

Captured with `node scripts/f1-capture-screenshots.mjs` against the local
source build. These synthetic fixtures are evidence only and cannot mutate
application data.

`layout-gate-results.json` records the automated viewport contract for both
surfaces. The capture fails before writing a successful result if it finds
document or mobile-navigation horizontal overflow, intersecting header
controls, missing main-content reservation, a mobile navigation visible at the
desktop breakpoint, insufficient focus scroll clearance, a focus target hidden
by the fixed navigation, an inaccessible More destination, a More dialog that
overlaps the navigation, a failed Escape/focus return, intersecting case-stage
cards, a missing stage projection, or anything other than one visible current
case step.
