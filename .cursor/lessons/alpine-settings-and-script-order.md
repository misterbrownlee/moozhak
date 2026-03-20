# Alpine.js: settings save failures and script order (moozhak)

## Symptoms (resolved)

- **Save** on `/settings` appeared to do nothing or behaved oddly.
- Browser console: **`Uncaught ReferenceError: save is not defined`** (Alpine), plus other undefined-related errors.
- Click handlers on the settings card resolved **`save`** in the **parent** `vinylApp()` scope, where `save` does not exist.

## Root cause

1. **`Alpine.data('moozhakSettings', …)` was registered in `document.addEventListener('alpine:init', …)` inside `web/public/app.js`.**
2. **In `web/views/layouts/main.ejs`, the Alpine CDN script loaded *before* `app.js`.** Alpine’s CDN build ends with `queueMicrotask(() => Alpine.start())`, so **`Alpine.start()` often ran before `app.js` executed**.
3. When `Alpine.start()` ran first, the **`alpine:init` listener was not yet attached**, so **`moozhakSettings` was never registered** before the DOM was initialized.
4. The settings subtree used `x-data="moozhakSettings"` expecting a registered component; without it, Alpine did not create the intended child scope. **`@click="save()"`** then looked up `save` on the ancestor **`vinylApp()`** component → **ReferenceError**.

**Nested `x-data` was fine; the bug was registration timing relative to `Alpine.start()`, not Alpine nesting itself.**

## Fixes applied

### 1. Script order (`web/views/layouts/main.ejs`)

Load scripts in this order:

1. `init-moozhak-domain.js` (module)
2. `app.js` (defer)
3. Alpine CDN (defer)

So **`vinylApp`**, **`moozhakSettingsPage`**, and any `alpine:init` hooks are defined **before** Alpine starts.

### 2. Settings component pattern (`web/public/app.js` + `web/views/settings.ejs`)

- Stopped relying on **`Alpine.data` + `alpine:init`** for the settings page.
- Added a **global factory** **`moozhakSettingsPage()`** (same idea as **`vinylApp()`**): plain function returning the component object, including **`save()`**.
- Template: **`x-data="moozhakSettingsPage()"`** instead of **`x-data="moozhakSettings"`**.

This avoids a race even if someone reorders scripts again: the factory must still be defined before Alpine evaluates `x-data`, which is enforced by keeping **`app.js` before Alpine**.

## Quick checklist for future Alpine + defer scripts

- [ ] Any **`Alpine.data(...)`** or **`alpine:init`** registration runs **before** `Alpine.start()` (script order or explicit `Alpine.plugin` / deferred start).
- [ ] For **`x-data="name"`** (string component name), the name must be registered **before** start.
- [ ] For **`x-data="someFn()"`**, **`someFn`** must exist in global scope (or Alpine’s eval scope) when the expression runs—typically **define it in a script that runs before Alpine**.
- [ ] If clicks hit the wrong scope, verify **inner `x-data`** actually created a component (registration / expression errors often fall through to parent).

## Related files (at time of writing)

- `web/views/layouts/main.ejs` — script order
- `web/public/app.js` — `vinylApp()`, `moozhakSettingsPage()`
- `web/views/settings.ejs` — `x-data="moozhakSettingsPage()"`

## Separate follow-up (not Alpine)

Discogs search failures with a **bogus saved token** showed up in API logs as **`database.search`** with a generic **`Unknown error.`**—fix credentials in Settings, not Alpine. Settings UI later was updated to **load saved secrets into fields** and **save all fields** (including clearing secrets when fields are emptied).
