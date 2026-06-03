# Pi Touchscreen Hide Normal Components

## Task summary
- Updated the touchscreen result overlay so normal detected components are not labeled on FAIL images.

## Scope
- Changed only touchscreen result overlay filtering.
- Kept inspection behavior, API calls, SSE handling, and canvas drawing mechanics unchanged.

## Changed files
- `pi-touchscreen/app.js`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-03_pi-touchscreen-hide-normal-components.md`

## Verification result
- Ran `node --check pi-touchscreen/app.js`.
- Did not run a browser visual check because no local touchscreen server was started for this task.

## Decisions made
- Treated these classes as normal component detections and hid them from the result overlay:
  - `mount_hole`
  - `gold_finger_row`
  - `fiducial`
  - `smd_array_block`
  - `ic_chip`
  - `edge_connector_zone`
- Kept `MISSING:*` visible even when the missing class is a normal component type.
- Kept `ANOMALY:*` and non-normal defect classes visible.

## Issues
- None found during static verification.

## Next steps
- Verify with a real FAIL image and confirm only the actual defect or missing-part cause is labeled.
