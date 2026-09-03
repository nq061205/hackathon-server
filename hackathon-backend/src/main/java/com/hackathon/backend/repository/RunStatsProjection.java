package com.hackathon.backend.repository;

/**
 * Projection cho thong ke mot luot chay. Do tre mang = received_at - car_timestamp
 * (mili giay). Gia tri AM nghia la dong ho xe chua dong bo NTP.
 */
public interface RunStatsProjection {
    Long getCnt();
    Double getAvgLatencyMs();
    Double getMinLatencyMs();
    Double getMaxLatencyMs();
    Long getMinSeq();
    Long getMaxSeq();
}
