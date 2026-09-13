package com.hackathon.backend.ws;

import com.hackathon.backend.dto.LeaderboardEntry;
import com.hackathon.backend.dto.LogResponse;
import com.hackathon.backend.dto.PageResponse;
import com.hackathon.backend.dto.RaceDataPush;
import com.hackathon.backend.dto.RunResponse;
import com.hackathon.backend.dto.RunStatsResponse;
import com.hackathon.backend.dto.TeamResponse;
import com.hackathon.backend.service.RunService;
import com.hackathon.backend.service.StatsService;
import com.hackathon.backend.service.TeamService;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Day du lieu dua xe qua WebSocket cho MOI client dang mo app cung luc, thay
 * cho viec moi cua so (chinh + cac cua so da "tach ra") tu poll REST rieng
 * theo dong ho cua no — kieu he thong TCDS cua pit wall F1: gom du lieu 1
 * lan, phat cho tat ca cung 1 thoi diem.
 *
 * Chay tren thread rieng cua @Scheduled (khong phai thread cua 1 HTTP
 * request) nen DataSourceContextHolder chua duoc JwtAuthFilter set — mac
 * dinh se la ADMIN (xem DataSourceContextHolder.get()). Chap nhan duoc: day
 * la code server noi bo (khong phai SQL tu client), va DTO tra ve deu la
 * cac lop doc-cong-khai (TeamResponse khong co password_hash...) giong het
 * REST /api/teams,/api/runs,... ma viewer van goi duoc — chi khac la audit
 * (admin-only) duoc phat rieng o topic /topic/admin/**, StompAuthChannelInterceptor
 * chan viewer subscribe topic do.
 */
@Component
public class RaceDataBroadcaster {

    private static final int LOG_PAGE_SIZE = 40;

    private final SimpMessagingTemplate messagingTemplate;
    private final TeamService teamService;
    private final RunService runService;
    private final StatsService statsService;

    public RaceDataBroadcaster(SimpMessagingTemplate messagingTemplate, TeamService teamService,
                                RunService runService, StatsService statsService) {
        this.messagingTemplate = messagingTemplate;
        this.teamService = teamService;
        this.runService = runService;
        this.statsService = statsService;
    }

    @Scheduled(fixedRate = 500)
    public void broadcast() {
        List<TeamResponse> teams = teamService.list();
        List<RunResponse> runs = runService.list(null);
        List<LeaderboardEntry> board = statsService.leaderboard();
        List<LogResponse> latestByRun = statsService.latestLive();

        // Chi tinh thong ke/log chi tiet cho cac luot dang 'running' — luot
        // da xong khong doi nua nen khong can day lai moi 500ms (frontend tu
        // fetch REST rieng khi giam khao chon xem lai 1 luot da xong).
        Map<Integer, RunStatsResponse> statsByRun = new HashMap<>();
        Map<Integer, List<LogResponse>> logsByRun = new HashMap<>();
        for (RunResponse r : runs) {
            if (!"running".equals(r.status())) continue;
            try {
                RunStatsResponse stats = statsService.runStats(r.id());
                statsByRun.put(r.id(), stats);

                // LogRepository gio tra ve sequence_no GIAM DAN (moi nhat truoc) -
                // trang 0 da la N dong moi nhat, khong can tinh "trang cuoi" +
                // dao nguoc nhu truoc nua (luc do repository con sap xep TANG DAN).
                PageResponse<LogResponse> logs = statsService.runLogs(r.id(), 0, LOG_PAGE_SIZE);
                logsByRun.put(r.id(), new ArrayList<>(logs.content()));
            } catch (Exception ignored) {
                // Luot vua doi trang thai giua chung (vd finish/void) -> bo
                // qua vong nay, vong sau (500ms toi) se dung lai.
            }
        }

        RaceDataPush payload = new RaceDataPush(
                Instant.now().toEpochMilli(), teams, runs, board, statsByRun, logsByRun, latestByRun);
        messagingTemplate.convertAndSend("/topic/race-data", payload);
    }
}
