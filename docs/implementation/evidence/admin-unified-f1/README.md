# Unified admin F1 visual evidence

Source-built, fail-closed visual evidence for the shared shell and component
contract. The routes return `404` unless `ADMIN_NEXT_VISUAL_FIXTURE=true`, and
they always return `404` when `NODE_ENV=production`.

| Capture | Viewport | Contract |
|---|---:|---|
| `unified-today-1440.png` | 1440×900 | Shared desktop shell and Today surface. |
| `unified-today-375.png` | 375×812 | Shared mobile shell, search and five primary destinations. |
| `component-catalog-1440.png` | 1440×1000 | Semantic status, owner, due, blocker, version, sync and async states. |
| `component-catalog-375.png` | 375×812 | Mobile wrapping, touch targets and no horizontal overflow. |

Captured with `node scripts/f1-capture-screenshots.mjs` against the local
source build. These synthetic fixtures are evidence only and cannot mutate
application data.
