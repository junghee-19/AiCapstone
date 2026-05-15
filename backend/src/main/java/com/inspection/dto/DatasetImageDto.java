package com.inspection.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class DatasetImageDto {

    private String deviceId;
    private String session;
    private String filename;
    private Long sizeBytes;
    private String createdAt;
    private String downloadUrl;
}
