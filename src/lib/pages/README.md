# Universal pages

Every page of NasDash (the official Home, Docker, Networks and Widgets pages and
pages created by users) is one `Page` document rendered by the same engine: a
free grid of widgets (GridStack, `src/components/pages/PageView.tsx`): widgets
stay where they are dropped (`float`), and positions never depend on content.

| Module | Role |
| --- | --- |
| `types.ts` | `Page` → `widgets`: each instance has its type, settings and grid placement `x, y, w, h` (24 columns, rows of 4 px; `h` is the last measured content height). Positions are stored as displayed when saved. |
| `validation.ts` | Strict server-side validation: placements inside the grid, unique ids, bounded JSON settings, no unknown fields. |
| `operations.ts` | Pure, immutable edits used by the editor: first free spot, insert, remove, hide, settings, applying grid positions, reflowing measured heights, resolving overlaps. |
| `presets.ts` | Official pages and page templates, built only from the widgets available to users. |
| `sectioned.ts` | Places an arrangement described with sections and columns on the grid (presets, legacy migration, `pages.json` v1). |
| `legacy-migration.ts` | One-time, deterministic conversion of the historical configuration into pages. Read-only on historical files. |
| `store.ts` | `pages.json` persistence and format upgrades (older files kept as `pages.v1.json` … `pages.v4.json`), demo sessions, backups (`pages.previous.json`), corrupt-file recovery, viewer filtering. |
| `../widgets/catalog.ts` | Server-safe widget catalogue built from `src/widgets/*/definition.ts`: groups, default width (columns), allowed widths (`sizes`, columns), minimum usable width (pixels, filters the allowed widths for the screen), `maxInstances`, access rules, settings screen. |

Rules worth keeping:

- A page describes presentation only. Widget settings reference resources
  (category, host, device) by id and never store credentials. Removing a widget
  never deletes its resource.
- The width is chosen by the user from both sides or any corner and snaps to
  the formats of the widget type (the `sizes` of each `src/widgets/<type>/definition.ts`, filtered by `grid.minPx` for the
  screen: `widthFormats`, `snapWidth`); neighbours are pushed down while
  resizing (`pushOverlaps`). The height always fits the content (no inner
  scrollbar). Widths stored before formats existed are kept until resized.
- Heights are measured continuously and the stored layout is reflowed around
  them (`reflowHeights`): each widget keeps its gap to the lowest widget above
  it. Titles shown in edit mode therefore push widgets down and leaving edit
  mode restores the stored layout exactly; estimated heights from a migration
  or template never leave holes.
- The grid is editable from 700 px wide; below, widgets are listed in reading
  order in one column whose heights follow the content.
- Visibility for non-admin users follows `canViewWidget`, identically on the
  server (`GET /api/pages`) and the client. Data routes keep their own checks.
- Saves carry the page `revision`; a stale revision returns `409` with the
  current page so the editor can reload or keep the local version.
- Resource actions (moving a service, stopping a container) apply immediately
  and are not part of the layout undo history.
