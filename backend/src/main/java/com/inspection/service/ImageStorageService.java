package com.inspection.service;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.format.DateTimeFormatter;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 검사 캡처 이미지 파일 저장/조회 서비스.
 *
 * <p>DB 에는 파일명만 저장하고 실제 바이너리는 디스크 (도커 볼륨) 에 둔다.
 * 저장 경로는 {@code inspection.image-storage-dir} 설정으로 주입.
 */
@Service
@Slf4j
public class ImageStorageService {

    private static final DateTimeFormatter TS_FMT =
            DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");

    private final Path storageDir;

    public ImageStorageService(@Value("${inspection.image-storage-dir}") String storageDirPath) {
        this.storageDir = Paths.get(storageDirPath).toAbsolutePath().normalize();
    }

    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(storageDir);
            log.info("[이미지저장] 저장 디렉토리 준비 완료: {}", storageDir);
        } catch (IOException e) {
            throw new IllegalStateException(
                    "이미지 저장 디렉토리 생성 실패: " + storageDir, e);
        }
    }

    /**
     * MultipartFile 을 디스크에 저장하고 저장된 파일명만 반환한다.
     *
     * @param file 업로드된 이미지 파일
     * @return 저장된 파일명 (DB 의 image_path 컬럼에 들어갈 값)
     */
    public String store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("저장할 파일이 비어 있습니다.");
        }

        String original = file.getOriginalFilename();
        String ext = extractExtension(original);
        String filename = String.format("%s_%s%s",
                LocalDateTime.now().format(TS_FMT),
                UUID.randomUUID().toString().substring(0, 8),
                ext);

        Path target = storageDir.resolve(filename).normalize();
        if (!target.startsWith(storageDir)) {
            throw new IllegalStateException("경로 탈출 시도 차단: " + filename);
        }

        try {
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            log.info("[이미지저장] 저장: {} ({} bytes)", filename, file.getSize());
            return filename;
        } catch (IOException e) {
            throw new RuntimeException("이미지 저장 실패: " + filename, e);
        }
    }

    /**
     * 파일명으로 저장된 이미지를 Resource 로 로드한다.
     */
    public Resource load(String filename) {
        if (filename == null || filename.isBlank()) {
            throw new IllegalArgumentException("파일명이 비어 있습니다.");
        }
        Path target = storageDir.resolve(filename).normalize();
        if (!target.startsWith(storageDir)) {
            throw new IllegalArgumentException("허용되지 않은 경로: " + filename);
        }
        if (!Files.exists(target) || !Files.isRegularFile(target)) {
            throw new IllegalArgumentException("이미지 없음: " + filename);
        }
        try {
            return new UrlResource(target.toUri());
        } catch (MalformedURLException e) {
            throw new RuntimeException("이미지 URL 변환 실패: " + filename, e);
        }
    }

    private static String extractExtension(String original) {
        if (original == null) {
            return ".jpg";
        }
        int dot = original.lastIndexOf('.');
        if (dot < 0 || dot == original.length() - 1) {
            return ".jpg";
        }
        String ext = original.substring(dot).toLowerCase();
        // PCB 검사 — jpg/jpeg/png/webp 만 허용. 그 외는 jpg 로 강제 변환.
        if (!ext.matches("\\.(jpg|jpeg|png|webp)")) {
            return ".jpg";
        }
        return ext;
    }
}
