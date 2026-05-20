package com.inspection.controller;

import com.inspection.dto.DatasetImageArchiveRequest;
import com.inspection.dto.DatasetImageDto;
import com.inspection.service.DatasetImageStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.zip.Deflater;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@RestController
@RequestMapping("/api/dataset-images")
@RequiredArgsConstructor
public class DatasetImageController {

    private final DatasetImageStorageService datasetImageStorageService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DatasetImageDto> uploadDatasetImage(
            @RequestPart("image") MultipartFile image,
            @RequestParam String deviceId,
            @RequestParam String session,
            @RequestParam Integer index
    ) {
        DatasetImageDto saved = datasetImageStorageService.store(image, deviceId, session, index);
        return ResponseEntity.status(201).body(saved);
    }

    @GetMapping
    public ResponseEntity<List<DatasetImageDto>> listDatasetImages() {
        return ResponseEntity.ok(datasetImageStorageService.list());
    }

    @PostMapping(value = "/archive", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StreamingResponseBody> downloadDatasetImageArchive(
            @RequestBody DatasetImageArchiveRequest request
    ) {
        List<DatasetImageArchiveRequest.Item> images =
                request == null || request.images() == null ? List.of() : request.images();

        if (images.isEmpty()) {
            throw new IllegalArgumentException("No dataset images selected.");
        }

        StreamingResponseBody body = outputStream -> writeArchive(outputStream, images);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/zip"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"dataset-images.zip\"")
                .body(body);
    }

    @GetMapping("/{deviceId}/{session}/{filename}")
    public ResponseEntity<Resource> downloadDatasetImage(
            @PathVariable String deviceId,
            @PathVariable String session,
            @PathVariable String filename
    ) {
        Resource resource = datasetImageStorageService.load(deviceId, session, filename);

        MediaType contentType = MediaType.IMAGE_JPEG;
        try {
            String probed = Files.probeContentType(resource.getFile().toPath());
            if (probed != null) {
                contentType = MediaType.parseMediaType(probed);
            }
        } catch (IOException ignored) {
            // 기본 JPEG 로 fallback
        }

        return ResponseEntity.ok()
                .contentType(contentType)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + resource.getFilename() + "\"")
                .body(resource);
    }

    @DeleteMapping("/{deviceId}/{session}/{filename}")
    public ResponseEntity<Void> deleteDatasetImage(
            @PathVariable String deviceId,
            @PathVariable String session,
            @PathVariable String filename
    ) {
        datasetImageStorageService.delete(deviceId, session, filename);
        return ResponseEntity.noContent().build();
    }

    private void writeArchive(
            OutputStream outputStream,
            List<DatasetImageArchiveRequest.Item> images
    ) throws IOException {
        try (ZipOutputStream zip = new ZipOutputStream(outputStream)) {
            zip.setLevel(Deflater.BEST_SPEED);
            for (DatasetImageArchiveRequest.Item image : images) {
                Path path = datasetImageStorageService.resolveImagePath(
                        image.deviceId(),
                        image.session(),
                        image.filename()
                );
                ZipEntry entry = new ZipEntry(zipEntryName(image));
                entry.setMethod(ZipEntry.DEFLATED);
                zip.putNextEntry(entry);
                Files.copy(path, zip);
                zip.closeEntry();
            }
            zip.finish();
        }
    }

    private String zipEntryName(DatasetImageArchiveRequest.Item image) {
        return sanitizeZipSegment(image.deviceId()) + "/" +
                sanitizeZipSegment(image.session()) + "/" +
                sanitizeZipSegment(image.filename());
    }

    private String sanitizeZipSegment(String value) {
        String v = value == null || value.isBlank() ? "unknown" : value.trim();
        return v.replaceAll("[^A-Za-z0-9._-]", "_");
    }
}
