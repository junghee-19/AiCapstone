package com.inspection.controller;

import com.inspection.dto.InspectionRequestDto;
import com.inspection.dto.InspectionResponseDto;
import com.inspection.service.InspectionService;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 검사 이력 REST API 컨트롤러
 *
 * <p>Base URL: /api/inspections
 *
 * <p>엔드포인트 목록:
 * - POST   /api/inspections          → 이미지 업로드 → inference-service 호출 → DB 저장
 * - GET    /api/inspections          → 전체 이력 조회 (프론트엔드)
 * - GET    /api/inspections/{id}     → 단건 상세 조회
 * - GET    /api/inspections/recent   → 최근 N건 조회
 * - GET    /api/inspections/stats    → 통계 요약
 * - GET    /api/inspections/period   → 기간 필터 조회
 * - DELETE /api/inspections          → 전체 이력 삭제 (대시보드)
 *
 * CORS는 {@link com.inspection.global.CorsConfig} 에서 전역 설정.
 *   - 환경변수 CORS_ALLOWED_ORIGINS 로 허용 origin 목록 주입
 */
@RestController
@RequestMapping("/api/inspections")
@Slf4j
@RequiredArgsConstructor
public class InspectionController {

    private final InspectionService inspectionService;
    private final RestTemplate restTemplate = new RestTemplate();

    /** inference-service base URL — docker-compose 내부 통신은 http://inference-service:8000 */
    @Value("${inference.service.url:http://inference-service:8000}")
    private String inferenceServiceUrl;

    // ========================================================================
    // 1. 검사 트리거 (프론트 → 이미지 업로드)
    // ========================================================================

    /**
     * 이미지 업로드 → inference-service 추론 → DB 저장 → 결과 반환
     *
     * <p>POST /api/inspections (multipart/form-data, image=<file>)
     *
     * <p>흐름:
     *   1. multipart 로 받은 이미지를 inference-service /inspect 로 forward
     *   2. inference-service 가 YOLO 추론 + 정렬 후 InspectionPacket JSON 반환
     *   3. 응답을 InspectionRequestDto 로 매핑하여 DB 저장
     *   4. 저장된 검사 이력을 호출자(프론트)에게 반환
     */
    @PostMapping
    public ResponseEntity<InspectionResponseDto> inspectImage(
            @RequestParam MultipartFile image) {

        if (image == null || image.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "image 파일이 비어 있습니다.");
        }

        log.info("[POST /api/inspections] inference 요청 — 파일: {}, 크기: {} bytes",
                image.getOriginalFilename(), image.getSize());

        InspectionRequestDto inferenceResult = forwardToInferenceService(image);

        log.info("[POST /api/inspections] inference 완료 — 결과: {}, 결함: {}건",
                inferenceResult.getResult(),
                inferenceResult.getDefects() == null ? 0 : inferenceResult.getDefects().size());

        InspectionResponseDto response = inspectionService.saveInspectionResult(inferenceResult);
        return ResponseEntity.status(201).body(response);
    }

    /** multipart 이미지를 inference-service /inspect 로 forwarding 한다. */
    private InspectionRequestDto forwardToInferenceService(MultipartFile image) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            ByteArrayResource fileResource = new ByteArrayResource(image.getBytes()) {
                @Override
                public String getFilename() {
                    String orig = image.getOriginalFilename();
                    return (orig == null || orig.isBlank()) ? "upload.jpg" : orig;
                }
            };

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("image", fileResource);

            HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);
            String url = inferenceServiceUrl + "/inspect";

            ResponseEntity<InspectionRequestDto> response = restTemplate.postForEntity(
                    url, request, InspectionRequestDto.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        "inference-service 응답 비정상: " + response.getStatusCode());
            }
            return response.getBody();

        } catch (IOException e) {
            log.error("[inference] 파일 읽기 실패", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "이미지 읽기 실패");
        } catch (RestClientException e) {
            log.error("[inference] inference-service 호출 실패: {}", e.getMessage());
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "inference-service 호출 실패: " + e.getMessage());
        }
    }

    // ========================================================================
    // 2. 이력 조회 (프론트엔드 → 서버)
    // ========================================================================

    /**
     * 전체 검사 이력 목록 조회
     *
     * <p>GET /api/inspections
     *
     * @return 200 OK + 검사 이력 목록
     */
    @GetMapping
    public ResponseEntity<List<InspectionResponseDto>> getAllInspections() {
        log.debug("[GET /api/inspections] 전체 이력 조회");
        return ResponseEntity.ok(inspectionService.getAllInspections());
    }

    /**
     * 단건 검사 이력 상세 조회
     *
     * <p>GET /api/inspections/{id}
     *
     * @param id 검사 로그 ID (PathVariable)
     * @return 200 OK + 검사 상세 DTO / 404 Not Found
     */
    @GetMapping("/{id}")
    public ResponseEntity<InspectionResponseDto> getInspectionById(
            @PathVariable Long id) {
        log.debug("[GET /api/inspections/{}] 단건 조회", id);
        return ResponseEntity.ok(inspectionService.getInspectionById(id));
    }

    /**
     * 최근 N건 검사 이력 조회 (대시보드 실시간 피드)
     *
     * <p>GET /api/inspections/recent?limit=10
     *
     * @param limit 조회 건수 (기본값: 10, 최솟값: 1)
     * @return 200 OK + 최근 N건 이력 목록
     */
    @GetMapping("/recent")
    public ResponseEntity<List<InspectionResponseDto>> getRecentInspections(
            @RequestParam(defaultValue = "10") @Min(1) int limit) {
        log.debug("[GET /api/inspections/recent] 최근 {}건 조회", limit);
        return ResponseEntity.ok(inspectionService.getRecentInspections(limit));
    }

    /**
     * 전체 통계 요약 조회 (대시보드 StatCard)
     *
     * <p>GET /api/inspections/stats
     *
     * <p>응답 예시:
     * {
     *   "totalCount": 350,
     *   "passCount": 320,
     *   "failCount": 30,
     *   "skippedCount": 8,
     *   "inspectedCount": 350,
     *   "failRate": 8.57
     * }
     *
     * @return 200 OK + 통계 집계 Map
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStatsSummary() {
        log.debug("[GET /api/inspections/stats] 통계 조회");
        return ResponseEntity.ok(inspectionService.getStatsSummary());
    }

    /**
     * 기간 단위 오류율 추이 조회
     *
     * <p>GET /api/inspections/stats/fail-rate-trend?groupBy=month&periods=6
     *
     * @param groupBy week 또는 month
     * @param periods 최근 구간 수
     * @return 200 OK + 기간별 오류율 추이
     */
    @GetMapping("/stats/fail-rate-trend")
    public ResponseEntity<List<Map<String, Object>>> getFailRateTrend(
            @RequestParam(defaultValue = "month") String groupBy,
            @RequestParam(defaultValue = "6") @Min(1) int periods) {
        log.debug("[GET /api/inspections/stats/fail-rate-trend] groupBy={}, periods={}", groupBy, periods);
        return ResponseEntity.ok(inspectionService.getFailRateTrend(groupBy, periods));
    }

    /**
     * 기간 필터 검사 이력 조회
     *
     * <p>GET /api/inspections/period?from=2026-03-01T00:00:00&to=2026-03-31T23:59:59
     *
     * @param from 시작 시각 (ISO 형식)
     * @param to   종료 시각 (ISO 형식)
     * @return 200 OK + 해당 기간 검사 이력 목록
     */
    @GetMapping("/period")
    public ResponseEntity<List<InspectionResponseDto>> getInspectionsByPeriod(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
        log.debug("[GET /api/inspections/period] {} ~ {}", from, to);
        return ResponseEntity.ok(inspectionService.getInspectionsByPeriod(from, to));
    }

    /**
     * 전체 검사 이력 및 결함 상세 삭제 (운영자 대시보드 초기화).
     *
     * <p>DELETE /api/inspections
     */
    @DeleteMapping
    public ResponseEntity<Void> deleteAllInspections() {
        log.warn("[DELETE /api/inspections] 전체 이력 삭제 요청");
        inspectionService.deleteAllInspections();
        return ResponseEntity.noContent().build();
    }
}
