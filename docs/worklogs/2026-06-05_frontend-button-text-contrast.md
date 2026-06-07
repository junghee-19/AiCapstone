# Frontend Button Text Contrast

## Task summary
- Improve low-contrast frontend button text colors caused by light tinted button backgrounds.

## Scope
- Settings device dataset capture buttons.
- Inspection detail original image download button.
- Matching dataset selected download button that used the same low-contrast indigo text pattern.

## Changed files
- `frontend/src/pages/SettingsPage.tsx`
- `frontend/src/components/inspection/DefectViewer.tsx`
- `frontend/src/pages/DatasetImagesPage.tsx`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-05_frontend-button-text-contrast.md`

## Verification result
- `rg -n "text-(emerald|sky|indigo)-100" frontend\src` found no remaining matching low-contrast button text classes.
- `npm run build` in `frontend/` succeeded after installing dependencies.
- Build completed with the existing Vite chunk-size warning for a bundle larger than 500 kB.

## Decisions made
- Kept the existing light tinted button backgrounds and borders.
- Changed only text colors from very light `*-100` tones to darker `*-700` tones for readability.
- Included the dataset selected download button because it used the same indigo low-contrast pattern as the inspection detail download button.

## Issues
- `npm install` reported 8 dependency vulnerabilities through npm audit output; this task did not change dependencies.
- Visual browser verification was not run because the requested fix was limited to Tailwind class contrast and the production build passed.

## Next steps
- Check the settings and inspection detail screens in the running UI to confirm the adjusted contrast under real data.
