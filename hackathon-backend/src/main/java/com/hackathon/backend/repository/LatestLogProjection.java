package com.hackathon.backend.repository;

/** Dòng log mới nhất của một lượt đang chạy (dùng cho bản đồ vị trí realtime). */
public interface LatestLogProjection {
    Integer getRunId();
    Integer getTeamId();
    Long getSequenceNo();
    Long getCarTimestamp();
    Long getReceivedAt();
    String getAiResult();
}
