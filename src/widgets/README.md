# Widgets

One folder per widget type:

| File | Role |
| --- | --- |
| `<type>/definition.ts` | Server-safe description: name and description keys, icon, library group, who can see it (`access`), settings tab, and **sizes** (`formats` = the only widths it can be resized to, `default`, `minPx`, `h`). |
| `<type>/view.tsx` | What it shows on a page. Receives `WidgetViewProps` (its instance and settings, edit mode, visibility, search…). |
| `definitions.ts` | The list of definitions (library order). Read by the catalogue, validation, access filtering, migration and resizing. |
| `views.ts` | The list of views, by type. Read by the page. |

A test checks that every definition has its folder, its view and a line in
`views.ts`, and that its sizes are valid.

## Adding a widget

1. Create `src/widgets/<type>/definition.ts` with `defineWidget({ … })`.
2. Create `src/widgets/<type>/view.tsx` exporting the component.
3. Add one line in `definitions.ts` and one in `views.ts`.
4. Add the name and description in `src/i18n/messages.ts` (4 languages).

It then appears in the widget library, can be placed, moved and resized in
its formats on every page, and follows the access rules of its definition.

## Changing the sizes of a widget

Edit the `sizes` line of its `definition.ts`. Widths already saved on pages
are kept until the widget is resized again.

## Data from integrations

Widgets showing machine metrics read the `Metric` values and vitals produced
by the integrations (`src/integrations/`), so a new monitoring source needs no
widget change. The Calme device widgets (Device, Fleet, Machines chart,
Storage) live in `devices/` and read `/api/devices/<id>/history` through one
shared store (`devices/deviceData.ts`); they draw with the chart kit in
`src/components/charts/`. Most views still delegate to the historical components in
`src/components/widgets/`; they move into their folder when redesigned.
