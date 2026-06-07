# Inspection detail overlay controls

## Task summary
- Added separate overlay toggles for normal component labels, defect labels, and missing labels in the inspection detail view.
- Split the right-side detail area into two panels so detection data is separated from inspection metadata.

## Scope
- Frontend inspection detail modal only.
- No backend, edge inference, reference matching, model, or API payload changes.

## Changed files
- `frontend/src/components/inspection/DefectViewer.tsx`
- `frontend/src/components/inspection/InspectionTable.tsx`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-07_inspection-detail-overlay-controls.md`

## Verification result
- `tsc --noEmit` passed using the bundled Node runtime.
- `vite build` passed using the bundled Node runtime.
- Vite reported the existing large chunk warning.

## Decisions made
- Normal components are detected by known component classes: `mount_hole`, `gold_finger_row`, `fiducial`, `smd_array_block`, `ic_chip`, and `edge_connector_zone`.
- Non-missing detections outside the normal component set are treated as defect labels.
- Missing labels remain based on `MISSING:` payloads and can be hidden independently.
- The inspection modal maximum width was increased to fit the new metadata panel plus detection data panel.

## Issues
- The frontend package manager command `npm run build` failed because the local global npm install is broken, so verification used the bundled Node runtime directly.

## Next steps
- Check the detail modal at desktop width with an inspection that has normal components, defects, and missing payloads to confirm the panel balance matches the target screen.
