# Dataset image ZIP download

## Task summary
- Change dataset image downloads so selected images are downloaded as one compressed ZIP archive.

## Scope
- Added a backend archive endpoint for selected dataset images.
- Updated the frontend selected-download flow to request and save the archive.
- Kept existing single image download and delete behavior unchanged.

## Changed files
- `backend/src/main/java/com/inspection/controller/DatasetImageController.java`
- `backend/src/main/java/com/inspection/dto/DatasetImageArchiveRequest.java`
- `backend/src/main/java/com/inspection/service/DatasetImageStorageService.java`
- `frontend/src/api/inspectionApi.ts`
- `frontend/src/pages/DatasetImagesPage.tsx`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-05-20_dataset-image-zip-download.md`

## Verification result
- Passed: `npm run build` in `frontend`.
- Not run: `mvn test` in `backend` because `mvn` is not installed and no Maven wrapper exists in the repository.

## Decisions made
- Used server-side ZIP streaming so multiple selected images download as one compressed file.
- Preserved the original storage path validation by reusing dataset image path resolution in the storage service.
- Kept row-level single image download links unchanged.

## Issues
- Backend test execution requires Maven or a Maven wrapper.

## Next steps
- Run backend tests once Maven is available.
- Optionally add MockMvc coverage for `POST /api/dataset-images/archive`.
