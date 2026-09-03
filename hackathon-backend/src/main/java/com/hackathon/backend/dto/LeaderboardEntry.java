package com.hackathon.backend.dto;

/**
 * Mot dong bang xep hang theo doi:
 *  - finishedRuns : so luot da 'finished'
 *  - bestDurationMs : luot 'finished' co thoi luong ngan nhat (null neu chua co)
 *  - totalLogs    : tong so goi log qua cac luot cua doi
 */
public record LeaderboardEntry(
        Integer teamId,
        String teamName,
        String carId,
        boolean active,
        long finishedRuns,
        Long bestDurationMs,
        long totalLogs) {
}
