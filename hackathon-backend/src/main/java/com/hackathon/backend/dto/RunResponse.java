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
        String note,
        // NULL = marshal chua bam "Bat dau ghi log" tren web cho luot nay -
        // hien thi cho admin/viewer xem tren dashboard. carlogd tren xe
        // KHONG doc truong nay qua day (RunResponse doi hoi JWT admin/viewer,
        // xem duoc moi doi) - xe doc qua endpoint rieng, gon hon va gioi han
        // dung doi minh: GET /api/teams/{id}/car-status (CarStatusResponse).
        Long carStartRequestedAt) {

    public static RunResponse from(Run r) {
        Long started = r.getStartedAt() != null ? r.getStartedAt().toEpochMilli() : null;
        Long ended = r.getEndedAt() != null ? r.getEndedAt().toEpochMilli() : null;
        Long carStart = r.getCarStartRequestedAt() != null ? r.getCarStartRequestedAt().toEpochMilli() : null;
        return new RunResponse(r.getId(), r.getTeamId(), r.getHeatNo(),
                started, ended, r.getStatus(), r.getResult(), r.getNote(), carStart);
    }
}
