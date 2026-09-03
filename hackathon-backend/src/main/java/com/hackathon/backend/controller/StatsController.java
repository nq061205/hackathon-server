package com.hackathon.backend.controller;

import com.hackathon.backend.dto.LeaderboardEntry;
import com.hackathon.backend.dto.LogResponse;
import com.hackathon.backend.dto.PageResponse;
import com.hackathon.backend.dto.RunResponse;
import com.hackathon.backend.dto.RunStatsResponse;
import com.hackathon.backend.service.RunService;
import com.hackathon.backend.service.StatsService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** API xem ket qua / thong ke — admin va viewer deu doc duoc. */
@RestController
@RequestMapping("/api")
public class StatsController {

    private final StatsService statsService;
    private final RunService runService;

    public StatsController(StatsService statsService, RunService runService) {
        this.statsService = statsService;
        this.runService = runService;
    }

    /** Thong ke tong hop mot luot (so goi, do tre, uoc luong mat goi, thoi luong). */
    @GetMapping("/runs/{id}/stats")
    public RunStatsResponse runStats(@PathVariable Integer id) {
        return statsService.runStats(id);
    }

    /** Log tho cua mot luot, phan trang (size toi da 2000). */
    @GetMapping("/runs/{id}/logs")
    public PageResponse<LogResponse> runLogs(@PathVariable Integer id,
                                             @RequestParam(defaultValue = "0") int page,
                                             @RequestParam(defaultValue = "200") int size) {
        return statsService.runLogs(id, page, size);
    }

    /** Danh sach luot chay cua mot doi. */
    @GetMapping("/teams/{id}/runs")
    public List<RunResponse> teamRuns(@PathVariable Integer id) {
        return runService.byTeam(id);
    }

    /** Bang xep hang theo doi. */
    @GetMapping("/leaderboard")
    public List<LeaderboardEntry> leaderboard() {
        return statsService.leaderboard();
    }

    /** Vi tri/telemetry moi nhat cua moi xe dang chay (ban do realtime cho giam khao). */
    @GetMapping("/live/latest")
    public List<LogResponse> liveLatest() {
        return statsService.latestLive();
    }
}
