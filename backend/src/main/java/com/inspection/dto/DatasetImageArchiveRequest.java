package com.inspection.dto;

import java.util.List;

public record DatasetImageArchiveRequest(List<Item> images) {

    public record Item(String deviceId, String session, String filename) {
    }
}
