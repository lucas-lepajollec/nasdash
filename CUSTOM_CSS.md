# Custom CSS

NasDash lets administrators add CSS from **Settings > Developer > Custom CSS**. Use it for visual adjustments only. It does not add backend capabilities, change permissions or replace the normal settings system.

## Recommended approach

Prefer the public `--nd-*` variables below over internal class selectors. Variables follow the active theme and are the compatibility contract for user themes. Internal `.nd-*` classes may change as the interface evolves.

```css
:root {
  --nd-accent: #7c3aed;
  --nd-accent-glow: rgba(124, 58, 237, 0.18);
  --nd-card-radius: 16px;
  --nd-card-border: rgba(124, 58, 237, 0.24);
}
```

### Public color and surface variables

| Variable | Purpose |
| --- | --- |
| `--nd-bg` | Page background color |
| `--nd-bg-surface` | Opaque surface color |
| `--nd-bg-gradient` | Page background gradient |
| `--nd-card-bg-rgb` | Card RGB channels, without alpha |
| `--nd-card-bg-opacity` | Card opacity |
| `--nd-card-bg` | Final card background |
| `--nd-subcard-bg` | Nested-card background |
| `--nd-card-border` | Default card and control border |
| `--nd-card-hover-border` | Interactive hover border |
| `--nd-card-shadow` | Card shadow |
| `--nd-text` | Primary text |
| `--nd-text-muted` | Secondary text |
| `--nd-text-dimmed` | Tertiary text |
| `--nd-accent` | Main accent |
| `--nd-accent-glow` | Accent glow/background |
| `--nd-accent-dim` | Muted accent |
| `--nd-green`, `--nd-yellow`, `--nd-orange`, `--nd-red` | Status colors |
| `--nd-blue`, `--nd-purple` | Supporting colors |
| `--nd-progress-bg`, `--nd-progress-fill` | Progress bars |
| `--nd-icon-bg`, `--nd-icon-border` | Icon containers |

### Public shape and motion variables

| Variable | Purpose |
| --- | --- |
| `--nd-card-radius` | Card and control corner radius |
| `--nd-blur` | Backdrop blur strength |
| `--nd-transition` | Standard transition timing |

## Responsive example

```css
:root {
  --nd-card-radius: 18px;
}

@media (max-width: 700px) {
  :root {
    --nd-card-radius: 10px;
    --nd-blur: 8px;
  }
}
```

## Safe recovery

Custom CSS can accidentally hide navigation or the settings button. Open NasDash with `?safe-css=1` to disable the saved CSS for that page load:

```text
https://your-nasdash.example/?safe-css=1
```

Then open **Settings > Developer > Custom CSS**, correct the rule or choose **Reset**, and reload the normal URL without `?safe-css=1`. The safe-mode parameter does not delete the saved value by itself.

## Limits and security

- The maximum stored value is 256 KiB.
- HTML/style breakouts, scripts, `javascript:`, `vbscript:`, `data:`, `expression()`, legacy browser behaviors and remote `@import` rules are neutralized.
- CSS comments are removed during sanitization.
- Do not paste CSS from an untrusted source. Ordinary external `url(...)` resources may contact another server and disclose the visitor's IP address.
- Custom CSS is backed up with the rest of `config.json`. Back up the complete NasDash data directory before large changes.

Sanitization is a defense-in-depth guardrail, not a reason to give an untrusted person administrator access.
