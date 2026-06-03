# Pi Touchscreen PCB Zoom

## Task summary
- Made the touchscreen result view zoom further into the PCB instead of preserving the full wide camera frame.

## Scope
- Changed only touchscreen result image crop rendering.
- Kept inspection behavior, overlay filtering, API calls, and state handling unchanged.
- Updated static asset version query strings to force kiosk browsers to load the new renderer.

## Changed files
- `pi-touchscreen/app.js`
- `pi-touchscreen/index.html`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-03_pi-touchscreen-pcb-zoom.md`

## Verification result
- Ran `node --check pi-touchscreen/app.js`.
- Did not run a browser visual check because no local touchscreen server was started for this task.

## Decisions made
- Removed result-area aspect-ratio expansion from the crop calculation because it was widening the crop back toward the full frame.
- Reduced crop padding so the PCB occupies more of the available vertical space.
- Allowed the canvas to keep the PCB crop's natural aspect ratio, even if that leaves side margins in the result frame.

## Issues
- If detections only cover a very small central defect area, the crop may zoom tightly around that area rather than the full board.

## Next steps
- Verify on `/touch` with real PASS and FAIL captures and tune padding if edge components are too close to the frame.
