# Pi Touchscreen Result Cache Bust

## Task summary
- Fixed the touchscreen still showing old result labels after normal component filtering.

## Scope
- Added cache busting for touchscreen CSS and JS asset URLs.
- Added no-store cache headers for the `/touch` HTML response.
- Hardened result overlay type normalization before normal component filtering.
- Kept inspection behavior, result state handling, and API contracts unchanged.

## Changed files
- `pi-touchscreen/index.html`
- `pi-touchscreen/app.js`
- `edge/api/touchscreen.py`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-03_pi-touchscreen-result-cache-bust.md`

## Verification result
- Ran `node --check pi-touchscreen/app.js`.
- Ran `python -m py_compile edge/api/touchscreen.py`.
- Confirmed `index.html` references versioned `style.css` and `app.js` URLs.
- Confirmed `/touch` HTML response includes `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`.

## Decisions made
- Treated the repeated F1/F2 and normal component labels as stale JavaScript symptoms because the visible overlay matched the old canvas renderer.
- Used URL query cache busting so kiosk browsers fetch the updated static assets without changing the static mount.
- Normalized defect type strings before filtering to handle whitespace or case variations.

## Issues
- Existing kiosk sessions may still need a page reload or browser restart once after deployment.

## Next steps
- Restart or refresh the kiosk browser on the Pi and confirm normal component labels no longer render.
