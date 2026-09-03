package com.hackathon.backend.dto;

import com.hackathon.backend.entity.LogEntry;

public record LogResponse(
        Integer runId,
        Integer teamId,
        Long sequenceNo,
        Long carTimestamp,
        Long receivedAt,
        Double latencyMs,
        String aiResult) {

    public static LogResponse from(LogEntry e) {
        Long carMs = e.getCarTimestamp() != null ? e.getCarTimestamp().toEpochMilli() : null;
        Long recvMs = e.getReceivedAt() != null ? e.getReceivedAt().toEpochMilli() : null;
        Double latency = (carMs != null && recvMs != null) ? (recvMs - carMs) * 1.0 : null;
        return new LogResponse(e.getRunId(), e.getTeamId(), e.getSequenceNo(),
                carMs, recvMs, latency, e.getAiResult());
    }
}
