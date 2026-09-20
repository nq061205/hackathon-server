package com.hackathon.backend.dto;

import java.util.List;
import java.util.Map;

/**
 * Goi du lieu day qua WebSocket toi TAT CA client dang mo app cung luc (xem
 * ws.RaceDataBroadcaster) — moi client nhan dung 1 goi tin nay tai cung 1
 * thoi diem, thay the cho viec moi cua so tu poll REST rieng theo dong ho
 * cua no (kieu he thong TCDS cua pit wall F1).
 *  - serverTime: epoch ms luc server gom du lieu.
 *  - statsByRun/logsByRun: CHI tinh cho cac luot dang 'running' (giong logic
 *    cu ben frontend truoc day) — luot da xong khong doi nua nen khong can
 *    day lai moi 500ms; frontend tu fetch REST rieng khi can xem lai luot cu.
 */
public record RaceDataPush(
        long serverTime,
        List<TeamResponse> teams,
        List<RunResponse> runs,
        List<LeaderboardEntry> board,
        Map<Integer, RunStatsResponse> statsByRun,
        Map<Integer, List<LogResponse>> logsByRun,
        List<LogResponse> latestByRun) {
}
