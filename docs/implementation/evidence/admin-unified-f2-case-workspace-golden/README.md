# Unified admin F2 Case Workspace golden-state evidence

Source-rendered visual evidence for all seven validated synthetic Case Workspace
states. The single fixture route requires both an allowlisted `state` and
allowlisted `lang`, returns `404` unless `ADMIN_NEXT_VISUAL_FIXTURE=true`, and
always returns `404` in a production build. It does not read or mutate shared
Preview or Production data.

| State                           | 375 | 768 | 1024 | 1440 |
| ------------------------------- | :-: | :-: | :--: | :--: |
| `executable_measurement_review` |  ✓  |  ✓  |  ✓   |  ✓   |
| `waiting_customer`              |  ✓  |  ✓  |  ✓   |  ✓   |
| `overdue_unassigned`            |  ✓  |  —  |  —   |  ✓   |
| `blocked_work_recovery`         |  ✓  |  ✓  |  ✓   |  ✓   |
| `capability_read_only`          |  ✓  |  —  |  —   |  ✓   |
| `target_unavailable`            |  ✓  |  —  |  —   |  ✓   |
| `completed_no_action`           |  ✓  |  ✓  |  ✓   |  ✓   |

The 22 PNGs use the pattern `<state>-<width>.png`. They were captured with
`node scripts/f2-capture-case-workspace-golden.mjs` against the local source
build. `layout-gate-results.json` contains the machine-readable result for every
state/viewport pair.

The capture fails when any state loses the canonical six stages, exposes more
than one current stage, renders a terminal state with an active stage, shows
more or less than one primary deep-link/neutral fallback, duplicates
`WORK_ORDER_BLOCKED`, leaves empty/unavailable audit feedback blank, overflows
the viewport, overlaps shell controls or stages, collides with the fixed mobile
navigation, or clips a focused control. The responsive header gate additionally
requires one unclipped column at 1024 and the intended two-column composition at 1440. Context navigation is keyboard-activated against all three native anchor
targets, maintains exactly one `aria-current="location"`, and the single history
rail is collapsed/reopened below `xl` while remaining visible at `xl`. The
executable, blocked and completed representatives also pass the natural 375px
mobile reflow gate and a 200% browser-zoom reflow simulation at 1024/1440
(halved CSS viewports of 512/720). A non-allowlisted fixture state must return
`404`.

The adapter is intentionally limited to visual evidence: it validates the
existing golden-state fixture, projects it into the final
`AdminNextCaseWorkspace` view, and does not alter either source contract.
