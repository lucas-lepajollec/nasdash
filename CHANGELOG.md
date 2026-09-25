# Changelog

Notable user-visible changes to NasDash will be recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and published versions will follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Every page (Home, Docker, Networks, Widgets and your own pages) is now a free grid of widgets. Official pages remain ready to use and can be rearranged, duplicated, restored or deleted like any other page.
- New default interface style **Calme** (quiet tinted neutrals, one sparing accent, Geist Mono, hairline cards, calmer titles, buttons, fields and dialogs), applied as a separate layer (`src/app/design-calme.css`). Appearance → Interface style switches back to **Classic** at any time. Under Calme, the historical default radius, card opacity and font count as not customised; values you chose still apply, as do all themes. Widgets get their Calme version one by one (clock, then weather: same locations, styles and refresh; new line icons with quiet animations, a discreet scene following the sky and the time of day at the location — day, night with stars, dawn, dusk, clouds, rain, snow, storm, fog — and a layout that drops secondary parts in narrow blocks instead of overflowing; motion stops when the system asks for reduced motion); the Classic style keeps the previous components. In edit mode, widget controls appear on hover and no longer cover Calme widget titles; entering or leaving edit mode re-places widgets in the same frame (heights are measured before the browser paints), so they never overlap during the switch. Service categories take the Calme title style and, unless a position was chosen, show their title above the card; service rows and pings are unchanged. The weather scene stays at the top of its card and fades out. The devices widget uses the Calme container (title above, thin flat gauges) with all its settings, styles and reordering unchanged. The calendar has a Calme version (quiet month grid, today in accent, a dot on days with events, upcoming events beside the grid from 520 px wide, event titles in the days from 760 px); days and events open the same dialogs, and events are loaded by a hook shared with the Classic version. The overview widget shows four quiet figures. The Docker, network, Tailscale and port widgets get a shared Calme shell (title above, flat block, no coloured title icon), and Docker lists, tabs, stats and logs are calmer (status shown by the dot, selection without glow). Second Calme pass: services in bento and logo layouts have a single level (no frame around each tile, a quiet surface on hover); the weather card drops the sky label (kept as the icon tooltip); the clock is a large light time with a hairline filling as the day goes by (its clock styles still apply); the overview shows the number of services with a bar split by category. The latency graph, Docker containers (short uptime, start/stop on hover, same host choice, pagination and automatic scrolling), Docker actions, Tailscale (online devices first), the ports widget (the signature line still toggles hidden categories for admins), the Network page tools and the Docker counters get their own Calme versions; containers, events and Tailscale devices are loaded by hooks shared with the Classic versions. Settings in the Calme style, following the D-Settings mock-up:
  - Navigation:
    - a short text navigation (Personalisation: Appearance, Wallpaper, Header, Mobile, Tabs and dock; Dashboard: Pages, Widgets; System: Users and access, Developer);
    - a search field that also finds each widget's options;
    - one "Widgets" hub listing every widget with the pages where it is placed.
  - Each section has a breadcrumb, a large title and one short line.
  - Explanations moved into small ⓘ tooltips, and the demo notice is a small tag.
  - Every section, and each widget's options, is rebuilt as a few airy blocks with one line per setting: segmented choices, sliders with their value, plain switches, and ordered lists with arrows for the header elements and the dock tabs.
  - New accent colour setting (six swatches or the theme's own).
  - Existing section links still work, the phone view keeps its menu then section drill-down, and the Classic style keeps the previous settings unchanged.
  - Users and access: the user list and a simple editor, with the role as a two-way choice and allowed tabs and widgets as chips.
- Calme dialogs:
  - calmer titles and labels;
  - demo notices as quiet text;
  - buttons at their natural width, grouped on the right, with the delete action apart;
  - lists as hairline rows;
  - a plain left-aligned confirmation;
  - a lighter widget library.
- Fixes:
  - drop-down lists stayed transparent: a low card opacity, then the rule that flattens nested boxes, made them see-through. They are now opaque and open upward when there is no room below. Header menus are opaque too;
  - ⓘ tooltips are no longer cut by scroll areas;
  - text buttons keep their icon beside the label.
- Appearance has two new options:
  - Outlines: remove the thin border around widgets, cards and dialogs;
  - Background blur: a slider that frosts what shows through translucent surfaces when there is a wallpaper.
- The theme and icon gallery opens inside the settings (the navigation stays): quiet theme thumbnails with search and dark/light filter, and icon styles shown as a row of samples.
- The network map dialogs (node, group, link, automatic generation) are rebuilt on a shared Calme dialog frame (`CalmeDialog`), with segmented choices for the category, direction and attachment points, a check list for group members, and explanations in ⓘ tooltips.
- The service, category, device, Docker action, Docker host, new event and event dialogs use the same Calme dialog frame:
  - fields one under the other, with their explanations in ⓘ;
  - segmented choices (action type, connection);
  - check lists for target containers;
  - expandable rows for the services of a category;
  - a footer with the delete action apart.
- Widgets can be resized from all around: sides change the width, top and bottom the height (a minimum the block stretches to; the content can still make it taller, and dragging back below the natural height returns to automatic), and corners both, with matching cursors.
- The clock and the overview drop their gauges. The Docker container list gets its light outline back, and the Docker containers widget has more room between rows.
- The latency graph is smoother, with a line fading in from the left, the average as a faint dashed line and a live dot. Average, range, jitter and quality became an option of the widget (Settings → Widgets → Network graph), off by default.
- The edit bar at the bottom of the page is a calm translucent pill with ghost buttons.
- Fixes:
  - edit controls no longer stay visible after closing a dialog opened from them;
  - the background blur now works (the finished entry animation kept widgets isolated from the page).
- Calme harmonisation:
  - one surface for every block: widgets, categories, the Docker detail, logs and container list, the network map, header controls and the edit bar. The same colour, card opacity, blur and outlines apply everywhere, and what sits inside a surface is transparent;
  - with outlines off, inner elements (stats, ports, hosts, map nodes and groups, choices, fields) get a very light fill instead of a border;
  - other themes stay translucent: they are no longer mixed with the opaque page colour.
- Resizing works from all around (sides, top, bottom, corners) but changes the width only; the height follows the content again.
- Categories can take any width (2 to 24 columns) to line up with their neighbours.
- Dragging a widget drops it exactly where it is released, even on a quick flick. GridStack measured the grab offset from the first move and refused large jumps; the drop is now computed from the pointer and the grab point, and neighbours are pushed down.
- Services: bigger logos in lists. In the grid with names, the tile is the logo background with the logo and the name inside.
- Performance:
  - entering or leaving edit mode takes about 50 ms instead of about 200 ms (grid moves applied in one batch);
  - pings no longer restart when an unrelated setting is saved, and pause while the tab is in the background;
  - the latency graph and the clock do no work on hidden pages;
  - a page is shown sooner after its widgets are measured.
- Services: logos in lists sit on a light translucent tile without outline. The four grid layouts (with names, and large, medium and small logos) share the category width in as many columns as fit, without the heavy tile background.
- The header search field and buttons line up exactly with the outer edges of the widgets. Edit controls sit flush in the widget's top-right corner, on its title row.
- With a background blur, blocks no longer fade in, so the blur is there at once on page changes (a fading block cannot blur what is behind it).
- Themes under Calme:
  - cards are fully opaque at 100 % card opacity, in the theme's own card colour. Before, they were half-transparent and, with the default opacity, fell back to the default theme's colour;
  - secondary tones that some themes do not define (secondary backgrounds, logo tiles, progress bars) are derived from the theme's text colour, which fixes the black active header button and dark controls;
  - sliders keep a visible track on light themes.
- Logo tiles are more visible, and logos are bigger in the grid layouts.
- The edit controls of a widget are a small solid pill again, flush in its corner.
- The resize arrow follows the edge: vertical on top and bottom, diagonal on corners. The resize still changes the width only.
- New **Settings → Integrations** page: every connection of the dashboard in one place, in the order a newcomer needs them. It starts with two steps (connect a monitoring source, then add your machines) ticked when done, then one block per category with the connections already set up (real logos, their state tested when the page opens, the machines using them) and the tiles to add one:
  - **machine monitoring**: Glances, Netdata, Beszel, Prometheus, Proxmox VE and Libre Hardware Monitor, each with its connections, the machines using them, a test and edit/remove;
  - **Docker containers**: the Docker/Podman engines;
  - **private network**: Tailscale or Headscale, in a dialog (the Tailscale widget settings now link there).
  A monitoring connection is saved once and shared: machines on the same Beszel, Prometheus or Proxmox server use one connection. Its test lists the server's machines, so they can be added at once when saving, and the device form picks the machine from that list instead of typing it. Single-machine sources (Glances, Netdata, LHM) can create their machine when the connection is saved.
- The device form no longer asks for addresses and credentials: it picks the source of its measures (with a link to manage the sources), and on a server the machine; with no source yet it explains the first step and links to the Integrations page. Existing devices are migrated on start (previous file kept as `config.pre-sources.json`); a device whose address cannot be read keeps its former connection. Connection addresses are no longer sent to non-admin users.
- In edit mode, the note beside a widget title ("2 / 4 online") keeps a gap before the widget's buttons.
- Widgets that cannot work yet show their first steps with direct links, in order: the machine widgets (connect a source, then add the machines), the Docker widgets (add an engine) and the Tailscale widget (connect Tailscale or Headscale). Visitors are told an administrator sets this up.
- Device widgets are set up in a real dialog (✎ in edit mode) instead of a drop-down menu; Docker Containers too (items per page, automatic scrolling). One model, shared by every device widget:
  - the machines to show (one for Device) and the measures to show: CPU, RAM, GPU, temperature (hottest part), load, network, disks and, for Device, the CPU + RAM history;
  - the display: figure, bar, ring or chart, the same for every measure or one per measure (a throughput is a figure or a chart);
  - a colour per measure, chosen in a small colour dialog: preset colours, favourites kept in the settings and shared by all widgets (`favoriteColors`), a free colour or its hex code, or back to the default;
  - a danger threshold per measure, with defaults (90 % for CPU, RAM, GPU and disks, 80 °C, a load of 1× per core, none for the network) and one danger colour for the widget: past its threshold a measure (bar, ring, figure, line of the Fleet) takes that colour, and charts show the threshold dashed. Colours are only ever hex values.
  The layout follows the width by itself: Device groups rings and figures side by side, bars below and charts across, with rings and charts sized to the widget (rings now show as rings at every size), and resizes down to 3 columns. The Fleet lays each machine's measures beside its name, or under it when they do not fit.
- New one-measure widgets: **CPU**, **RAM**, **GPU**, **Temperatures**, **Load** and **Network**, a figure, bar or ring per machine or one chart with a line per machine and the danger threshold; **Storage** is now the disk version (every disk, the fullest first). The machines chart gains the same dialog (measure, style, height, machines, colour, threshold).
- Device widgets, third pass:
  - the machines chart leaves the library: the one-measure widgets drawn as charts cover it, and the machines charts already placed show as the one-measure widget of their measure, with their machines, style and height;
  - when a measure (or all of them) is drawn as a chart, its dialog offers the chart type (filled area, line, bars) and height (small, medium, large);
  - switching from one display per measure to one for all and back gives each measure its own display again (each keeps its own choice and chart options);
  - one-measure widgets give each machine its own colour (a distinct one by default on charts), and their dialog sets, for the whole widget, how RAM and disks are written (percentage, used size or free size) and the extra figures: CPU temperature and load, GPU temperature and video memory, upload, load averages and cores, the part a temperature comes from;
  - RAM and Storage show any of their share, used size, free size and total size (several can be ticked, only those are shown, a size is followed by the total: `210 Go / 500 Go`); by default the share and the total;
  - the 1 h / 24 h switch and the default period only appear where something is drawn as a chart;
  - in the settings dialogs, each machine has a button to its own settings (the changes made in the dialog are kept);
  - rings are centred in their cell, the name of a machine or disk sits under the ring (short names like CPU stay inside), and long texts are shortened.
- Very narrow blocks no longer force a minimum width on container and action lists.
- Drop-down lists are drawn above the page, positioned on their field: dialogs and scroll areas can no longer cut them (the monitoring API list of the device dialog was hidden at the top). They open downward, or upward when there is more room, never taller than the room they have.
- Dropping a widget just under another no longer swaps them: when the dropped widget's top edge lands in the lower half of the one above, it settles right below it; in the upper half, it takes its place as before. The drop is decided from the layout as it was when the drag started.
- New device widgets, drawn with a shared Calme chart kit (`src/components/charts`: smooth time chart with a gradient, live dot, dashed cursor and a tooltip that stays inside its block; thin rings; stretchable sparklines; usage bars). One colour per kind of measurement everywhere (CPU accent, RAM violet, disk amber, GPU green) and an orange alert tone only for parts at 80 °C or more and disks at 90 % or more:
  - **Device**: one machine in detail. Wide, it shows CPU and RAM rings, temperature, load against the core count, received and sent throughput, GPU, CPU + RAM over 1 h or 24 h with exact values under the pointer, and disks with free space. Below 440 px it shows one line per measurement with its curve, a network and load line, and the disks;
  - **Machines chart**: CPU, RAM, GPU, temperature or network for several machines, one line each, all values in the tooltip;
  - **Storage**: every disk of every machine, the fullest first, with free space and the total in the title;
  - under Calme, the **Devices** widget becomes the **Fleet**: one line per machine with state, CPU and RAM bars, the CPU trend of the last hour (from 520 px) and the hottest temperature (from 400 px); below 300 px the name sits above the bars. Offline machines are dimmed and its choice of devices is kept. The Classic cards are unchanged and it now resizes up to the full width.
  Widgets showing the same machine share one reader, which polls every 10 s only while one of them is visible, and each widget's options (machine, measure, machines, default period) sit in its edit-mode menu. The 1 h / 24 h switch sits inside the block, so it stays reachable when widget titles are hidden.
- Devices now have a server-side history: every poll for the last hour and one averaged point with its peak per minute for 24 hours, saved to `data/metrics-history.json` so a restart keeps the day. Monitoring starts with the server and keeps polling once a minute when nobody is watching (every 10 s while a dashboard is open), so charts can open already filled. `GET /api/devices/<id>/history?range=1h|24h&since=<ms>` returns the current reading, the new vitals and the series; the demo computes repeatable moving curves.
- Device integrations report vitals besides usage gauges: uptime, load average, CPU count and network throughput (physical interfaces only) for Glances, Netdata, Prometheus (queries now sent together), Beszel (total bandwidth), Proxmox (uptime and load of a node; throughput of a guest from its counters) and Libre Hardware Monitor (adapter throughput).
- Appearance → Soft edges (0–20 px): widgets and blocks fade softly into the page instead of ending on a sharp edge, header controls included (half as wide); the outline gives way while it is on and the content is untouched.
- Network map rebuilt:
  - the historical structure is kept, with room to breathe: infrastructure, machines and network services in a left column (one card per row), a wide corridor, then the application groups on aligned rows (two cards per row); cards widen or narrow a little so the applications keep their columns;
  - links are bundled by source: the links of a machine leave from one point, share a trunk down the corridor and branch off into the side of each group, while other sources keep to their own lanes; two elements facing each other over a free gap are joined by a straight line (without arrowheads between close neighbours); for other links, a single search tries every sensible pair of sides at once and keeps the cheapest path (length, bends, crossing other lanes), around every card, group title and layer heading, always leaving and entering a card straight from its side; attachment sides chosen in the link dialog are kept when they cost about the same, and otherwise replaced rather than drawing a line through the cards (sides saved for an older layout no longer force loops);
  - port lists are no longer written along links (automatic generation stops adding them): each card shows its full address with the port (the linked service's local address, or its IP and first port) and, outside edit mode, opens it; other link labels take a free spot along their link, or show while the link is lit;
  - the layers are told apart by a coloured dot on their heading and a tinted tile behind each node's icon (no more coloured edge on one side);
  - the mouse wheel keeps scrolling the page over the map;
  - hovering a node lights the links it sends (and two-way links; the links it receives only when it sends none) and dims the rest; linked groups light up with their cards; search dims non-matching nodes;
  - in edit mode, a node, a group or a link opens its dialog, and the small handle of a node draws a new link onto another node or group;
  - the map fills the width of its block and never shrinks below a readable size: a wider map is panned sideways by dragging the background, or zoomed with the buttons;
  - narrow blocks and phones open on a list view (one section per layer, each node with its links), with the map one tap away;
  - about 1,800 lines of the previous routing are gone, with no new dependency; layout tests check that cards and groups never overlap, applications stay right of the network layers, links end on their targets and never cross a card, and 240 random maps (widths, card sizes, fixed sides, labels) are checked for lines through cards, U-turns, hidden arrows and entries from inside; a 70-node map is laid out in about 130 ms (a 60-node homelab map in about 50 ms). Under Calme, cards of the other themes are blended with the page background so they stand out less.
- Service pings reach HTTPS services with a self-signed certificate (Proxmox, NAS interfaces…): the ping retries without the certificate check (also when an http:// address redirects to such an HTTPS address), since it sends no credentials, and shows “OK · self-signed certificate”. Refused connections are reported consistently by both ping routes.
- Docker hosts can be a Portainer environment (relayed Docker API, API key) or a Dockhand environment (its API translated to Docker's); their keys are encrypted on disk, masked for admins and never sent to other users.
- The Security settings list the widgets that can be granted from the widget definitions, and pages created by admins from the pages themselves (the removed custom-tabs endpoint is no longer called).
- New monitoring integrations: Netdata, Beszel (one device per Beszel system) and Prometheus with node_exporter (one device per `instance`); Headscale can feed the Tailscale widget (the connection saved last is used). Docker hosts can also be reached through a Unix socket mounted into the container (Docker or Podman) or over HTTPS. Any HTTPS device or Docker host can accept a self-signed certificate (Proxmox's default), with a clear message when a certificate is refused. `npm run fake:integrations` now also serves Netdata, Beszel, Prometheus, Headscale, Docker (TCP and socket) and a self-signed HTTPS case.
- Each widget type now lives in `src/widgets/<type>/` (`definition.ts` for name, access and sizes; `view.tsx` for the display); the widget catalogue, sizes table and two render switches are replaced by these files.
- Tailscale credentials are now a saved connection in `config.integrations` (secrets encrypted on disk, masked for admins, never sent to other users) instead of `settings`; existing configurations are migrated automatically and the previous file is kept as `config.pre-integrations.json`. The Tailscale settings form is drawn from its integration description. `npm run fake:integrations` starts local fake Glances and Libre Hardware Monitor servers (plus error cases) to try integrations without installing them.
- Device monitoring integrations (Glances, Proxmox VE, Libre Hardware Monitor) now live in `src/integrations/`: each one declares its form fields and endpoint in a manifest and reads its API in a collector that returns structured metrics. The device form, request validation, configuration API and background polling all read one registry, so adding a monitoring source no longer means editing them. The devices route now answers with these metrics and the Devices widget formats them itself (units in the interface language, colours by metric type) instead of re-reading display strings; devices without an integration keep their hand-written stats. Saved "visible stats" selections keep working.
- Edit mode works the same on every page: press anywhere on a widget and drop it anywhere on the 24-column grid, horizontally and vertically; widgets in the way move aside with an animation, and empty space is kept. Drag either side or any corner (a small triangle marks the bottom-right one) to change the width: it jumps between the formats of the widget (for example 3, 4, 6 or 8 columns for the clock, 12 to 24 for the topology), and formats narrower than the widget's minimum usable width at the current screen width are skipped, so a widget is never left in a width its content does not support; widgets in the way move down while resizing and come back if it shrinks again. The height always fits the content, with no inner scrollbar, including while resizing. On the first visit of a page the grid appears once its widgets are measured, without widgets jumping into place. Vertical gaps are kept when heights change: titles shown in edit mode push the widgets below down, and leaving edit mode brings them back without leaving space. Each widget shows its controls (its own buttons, configure, remove) in its top-right corner while editing; hidden widgets can be shown again from the library. A searchable library adds widgets at the first free spot, and changes support undo/redo (Ctrl+Z / Ctrl+Shift+Z) with an explicit Save or Cancel. Below 700 px the page becomes one read-only column where heights follow the content.
- Service categories, the Docker page blocks (hosts, counters, container list, explorer) and the network tools and topology are now widgets that can be placed on any page. Docker widgets on the same page stay linked to the same host and container.
- Settings → Pages creates a page, either blank or as a copy of an official page.

### Changed

- Page layouts are stored in `pages.json` in the data directory, created automatically from the existing configuration on first start. `config.json`, `services.json` and `custom_tabs.json` are not modified, so the previous version still runs on the same data. Earlier development formats of `pages.json` are converted once, and the original is kept as `pages.v1.json`, `pages.v2.json`, `pages.v3.json` or `pages.v4.json`. Spacer widgets are no longer needed and are removed from converted pages. Deleting a page or restoring an official one keeps the prior pages in `pages.previous.json`. An edit made at the same time in another tab is detected and never silently overwritten.
- Widget settings no longer contain on/off switches or panel positions: a widget appears where it is placed, and each settings screen shows the pages that use it. Home-only options moved to Settings → Services, network map options to Settings → Network topology.
- The custom tab row/column builder and its `/api/custom-tabs` endpoint are replaced by pages and `/api/pages`.

### Security

- Update Next.js to `16.3.4` and pin patched Vitest/js-yaml so the protected dependency audit can pass.

### Changed

- Treat `.env` as an optional advanced override while preserving generated first-start credentials when it is absent.
- Let Docker Compose derive stack and container names, avoiding fixed global names and allowing multiple installations to coexist.
- Keep every copy-ready Compose example on `./data`. A named volume is an optional new-install alternative, not the default: switching an existing folder install to `nasdash-data` leaves the real files unused.
- Refresh README product screenshots from the isolated English public demo, with the intro dialog closed and additional views of Docker, networks, widgets, settings, theme variants, layout options, and mobile.

## [0.1.4] - 2026-09-08

### Changed

- Keep the default Compose file literal and copy-ready: it now names the published GHCR image directly and relies on NasDash's persisted first-start credential generation instead of optional interpolation variables.

## [0.1.3] - 2026-09-08

### Changed

- Simplify the default Compose files to the settings NasDash actually needs, while preserving the established Docker host port `2504`, persistence and restricted Docker socket proxy.
- Use matching port `2505` on both sides of the isolated public-demo proxy mapping; the production application remains on `2504:2504`.

## [0.1.2] - 2026-09-08

### Changed

- Compose now pulls the published image and uses Docker's standard all-interface port mapping by default. Use `127.0.0.1:2504:2504` for localhost-only publication; source builds use the explicit build override.
- No configuration or persistent-data migration is required; operators recreating an existing container should review the new LAN-reachable port default.

## [0.1.1] - 2026-09-06

### Security

- Restrict service ping requests to administrator-configured targets instead of accepting arbitrary outbound destinations.
- Restore normal TLS certificate verification for Proxmox requests and document custom-CA trust through the runtime environment.
- Render custom CSS without an HTML injection sink and remove unsafe previews of untrusted logo URLs.

### Changed

- Add complete dependency auditing and a non-regression lint ceiling to the protected quality gates.

## [0.1.0] - 2026-09-06

### Added

- The first deliberately maintained NasDash release line.
- A self-hosted homelab cockpit for services, hosts, Docker, network topology, widgets, tabs and theming.
- A consistent repository, quality, security, and release foundation.
- A maintained English, French, Spanish, and German interface with persisted language selection and locale-aware formatting.
- Versioned configuration and backup formats, atomic persistence, encrypted integration credentials and tested backup/restore tooling.
- Multi-architecture container images with health checks, SBOM, provenance and immutable commit-SHA rollback tags.

Earlier development remains available in Git history; this changelog does not invent releases that were never deliberately published.

[Unreleased]: https://github.com/lucas-lepajollec/nasdash/compare/v0.1.4...HEAD
[0.1.4]: https://github.com/lucas-lepajollec/nasdash/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/lucas-lepajollec/nasdash/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/lucas-lepajollec/nasdash/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/lucas-lepajollec/nasdash/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/lucas-lepajollec/nasdash/releases/tag/v0.1.0
