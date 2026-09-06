package com.hackathon.backend.service;

import com.hackathon.backend.dto.*;
import com.hackathon.backend.entity.LogEntry;
import com.hackathon.backend.entity.Run;
import com.hackathon.backend.exception.ApiException;
import com.hackathon.backend.repository.LeaderboardProjection;
import com.hackathon.backend.repository.LogRepository;
import com.hackathon.backend.repository.RunRepository;
import com.hackathon.backend.repository.RunStatsProjection;
import com.hackathon.backend.repository.TeamRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Service
public class StatsService {

    private final RunRepository runRepository;
    private final LogRepository logRepository;
    private final TeamRepository teamRepository;

    public StatsService(RunRepository runRepository, LogRepository logRepository, TeamRepository teamRepository) {
        this.runRepository = runRepository;
        this.logRepository = logRepository;
        this.teamRepository = teamRepository;
    }

    @Transactional(readOnly = true)
    public RunStatsResponse runStats(Integer runId) {
        Run run = runRepository.findById(runId)
                .orElseThrow(() -> ApiException.notFound("Khong tim thay luot chay id=" + runId));

        RunStatsProjection p = logRepository.statsForRun(runId);
        long cnt = p != null && p.getCnt() != null ? p.getCnt() : 0L;
        Long minSeq = p != null ? p.getMinSeq() : null;
        Long maxSeq = p != null ? p.getMaxSeq() : null;

        Long expected = null;
        Long lost = null;
        if (minSeq != null && maxSeq != null) {
            expected = maxSeq - minSeq + 1;
            lost = expected - cnt;
        }

        Long durationMs = null;
        if (run.getEndedAt() != null && run.getStartedAt() != null) {
            durationMs = Duration.between(run.getStartedAt(), run.getEndedAt()).toMillis();
        }

        return new RunStatsResponse(
                runId,
                run.getStatus(),
                cnt,
                p != null ? p.getAvgLatencyMs() : null,
                p != null ? p.getMinLatencyMs() : null,
                p != null ? p.getMaxLatencyMs() : null,
                minSeq, maxSeq, expected, lost, durationMs);
    }

    @Transactional(readOnly = true)
    public PageResponse<LogResponse> runLogs(Integer runId, int page, int size) {
        if (!runRepository.existsById(runId)) {
            throw ApiException.notFound("Khong tim thay luot chay id=" + runId);
        }
        int safeSize = Math.min(Math.max(size, 1), 2000);
        Page<LogEntry> p = logRepository.findByRunIdOrderBySequenceNoAsc(
                runId, PageRequest.of(Math.max(page, 0), safeSize));
        List<LogResponse> content = p.getContent().stream().map(LogResponse::from).toList();
        return PageResponse.of(p, content);
    }

    /** Vị trí/telemetry mới nhất của mọi xe đang chạy — cho bản đồ realtime. */
    @Transactional(readOnly = true)
    public List<LogResponse> latestLive() {
        return logRepository.latestPerRunningRun().stream().map(p -> {
            Double latency = (p.getReceivedAt() != null && p.getCarTimestamp() != null)
                    ? (p.getReceivedAt() - p.getCarTimestamp()) * 1.0 : null;
            return new LogResponse(p.getRunId(), p.getTeamId(), p.getSequenceNo(),
                    p.getCarTimestamp(), p.getReceivedAt(), latency, p.getAiResult());
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<LeaderboardEntry> leaderboard() {
        // MOT truy van cho ca bang (xem TeamRepository.leaderboardRows).
        List<LeaderboardEntry> out = new ArrayList<>();
        for (LeaderboardProjection p : teamRepository.leaderboardRows()) {
            out.add(new LeaderboardEntry(
                    p.getTeamId(),
                    p.getTeamName(),
                    p.getCarId(),
                    Boolean.TRUE.equals(p.getActive()),
                    p.getFinishedRuns() != null ? p.getFinishedRuns() : 0L,
                    p.getBestDurationMs(),
                    p.getTotalLogs() != null ? p.getTotalLogs() : 0L));
        }

        // Sap xep: doi co luot finished truoc, thoi gian tot nhat len dau.
        out.sort((a, b) -> {
            if (a.bestDurationMs() == null && b.bestDurationMs() == null) return 0;
            if (a.bestDurationMs() == null) return 1;
            if (b.bestDurationMs() == null) return -1;
            return Long.compare(a.bestDurationMs(), b.bestDurationMs());
        });
        return out;
    }
}
