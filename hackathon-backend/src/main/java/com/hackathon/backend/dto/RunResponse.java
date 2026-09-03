package com.hackathon.backend.dto;

import com.hackathon.backend.entity.Run;

public record RunResponse(
        Integer id,
        Integer teamId,
        Integer heatNo,
        Long startedAt,
        Long endedAt,
        String status,
        String result,
        String note) {

    public static RunResponse from(Run r) {
        Long started = r.getStartedAt() != null ? r.getStartedAt().toEpochMilli() : null;
        Long ended = r.getEndedAt() != null ? r.getEndedAt().toEpochMilli() : null;
        return new RunResponse(r.getId(), r.getTeamId(), r.getHeatNo(),
                started, ended, r.getStatus(), r.getResult(), r.getNote());
    }
}
