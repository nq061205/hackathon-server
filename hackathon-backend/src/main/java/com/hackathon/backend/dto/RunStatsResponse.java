package com.hackathon.backend.dto;

/**
 * Thong ke mot luot chay.
 *  - logCount       : so goi log ghi nhan
 *  - avg/min/max LatencyMs : do tre mang (received_at - car_timestamp), mili giay.
 *                    Gia tri AM = dong ho xe chua dong bo NTP.
 *  - minSeq/maxSeq  : khoang so thu tu goi (phat hien mat goi neu maxSeq+1 > count).
 *  - expectedIfContiguous : maxSeq - minSeq + 1 (so goi le ra phai co neu khong mat goi).
 *  - lostEstimate   : expectedIfContiguous - logCount (uoc luong so goi mat).
 *  - durationMs     : thoi luong luot chay (ended_at - started_at) neu da ket thuc.
 */
public record RunStatsResponse(
        Integer runId,
        String status,
        long logCount,
        Double avgLatencyMs,
        Double minLatencyMs,
        Double maxLatencyMs,
        Long minSeq,
        Long maxSeq,
        Long expectedIfContiguous,
        Long lostEstimate,
        Long durationMs) {
}
