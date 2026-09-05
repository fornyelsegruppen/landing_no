# Unified admin F2 Work Queue evidence

Source-rendered, fail-closed visual evidence for the synthetic Preview Work
Queue. The fixture route returns `404` unless
`ADMIN_NEXT_VISUAL_FIXTURE=true`, and it always returns `404` in a production
build.

| Capture               |  Viewport | Contract                                                                                   |
| --------------------- | --------: | ------------------------------------------------------------------------------------------ |
| `work-queue-375.png`  |   375×812 | Compact filters, touch targets, stacked master/detail and safe fixed-navigation clearance. |
| `work-queue-768.png`  |  768×1024 | Tablet filters and stacked master/detail without horizontal overflow.                      |
| `work-queue-1024.png` |  1024×900 | Sidebar breakpoint, desktop navigation and stacked detail reading width.                   |
| `work-queue-1440.png` | 1440×1000 | Wide side-by-side master/detail with an explicit shadow-read, non-executable state.        |

Captured with `node scripts/f2-capture-work-queue.mjs` against the local source
build. `layout-gate-results.json` records the automated viewport checks. The
capture fails if it finds document/mobile-navigation overflow, intersecting
header controls, insufficient safe-area/focus clearance, incorrect responsive
master/detail geometry, missing interaction states, an inline action button, a
synthetic executable state or CTA, filter state that retains `cursor` or
`selected`, or a filtered-out selection that exposes detail or an action.

The fixture is a synthetic `shadow_read` and all of its rows fail closed as
waiting or read-only. Executable invariants are covered separately by contract
and adapter tests with an explicit canonical capability and exact target. The
fixture does not load or mutate shared Preview or Production data.
