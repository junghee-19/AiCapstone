# Edge Reference Profile Deploy

## Task summary
- Deploy the same normal component coordinate data used by PCB information to the edge runtime so missing checks can compare expected positions one by one.

## Scope
- Edge reference profile data.
- Edge board expected counts alignment.
- Edge environment example for enabling reference position checks.

## Changed files
- `edge/config/reference_profile.gt125a.json`
- `edge/config/board_profiles.json`
- `edge/.env.example`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-05_edge-reference-profile-deploy.md`

## Verification result
- `python -m json.tool edge\config\reference_profile.gt125a.json` succeeded.
- `python -m json.tool edge\config\board_profiles.json` succeeded.
- `python -m py_compile edge\main.py edge\inference\reference_check.py` succeeded.
- Reference profile class counts match `G_SERIES.expected_counts`.

## Decisions made
- Added a tracked deployable reference profile at `edge/config/reference_profile.gt125a.json`.
- Left `edge/config/reference_profile.json` as the ignored runtime-generated path, so manual registration can still create local profiles without committing them.
- Updated `.env.example` to enable reference checks and point to the deployable GT-125A profile.
- Updated `edge_connector_zone` expected count from 1 to 2 to match the PCB information reference data.

## Issues
- Real edge-device inspection still needs to validate whether `REFERENCE_MATCH_TOLERANCE_PX=80` is appropriate for the camera/model output.

## Next steps
- Deploy to the edge device, confirm `.env` contains `REFERENCE_CHECK_ENABLED=true`, and run one known-good board plus one missing-component board.
