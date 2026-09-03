package com.hackathon.backend.repository;

import com.hackathon.backend.entity.LogEntry;
import com.hackathon.backend.entity.LogId;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LogRepository extends JpaRepository<LogEntry, LogId> {

    Page<LogEntry> findByRunIdOrderBySequenceNoAsc(Integer runId, Pageable pageable);

    long countByRunId(Integer runId);

    // car_timestamp / received_at la TIMESTAMPTZ -> do tre (ms) = EXTRACT(EPOCH ...)*1000.
    @Query(value = """
            SELECT COUNT(*) AS "cnt",
                   AVG(EXTRACT(EPOCH FROM (received_at - car_timestamp)) * 1000) AS "avgLatencyMs",
                   MIN(EXTRACT(EPOCH FROM (received_at - car_timestamp)) * 1000) AS "minLatencyMs",
                   MAX(EXTRACT(EPOCH FROM (received_at - car_timestamp)) * 1000) AS "maxLatencyMs",
                   MIN(sequence_no) AS "minSeq",
                   MAX(sequence_no) AS "maxSeq"
            FROM logs
            WHERE run_id = :runId
            """, nativeQuery = true)
    RunStatsProjection statsForRun(@Param("runId") Integer runId);

    /** Dòng log mới nhất (theo sequence_no) của MỖI lượt đang 'running' — cho bản đồ vị trí realtime. */
    // Tra ve car_timestamp / received_at duoi dang epoch-ms (bigint) de khop LatestLogProjection (Long).
    @Query(value = """
            SELECT DISTINCT ON (l.run_id)
                   l.run_id        AS "runId",
                   l.team_id       AS "teamId",
                   l.sequence_no   AS "sequenceNo",
                   (EXTRACT(EPOCH FROM l.car_timestamp) * 1000)::bigint AS "carTimestamp",
                   (EXTRACT(EPOCH FROM l.received_at)   * 1000)::bigint AS "receivedAt",
                   l.ai_result     AS "aiResult"
            FROM logs l
            JOIN runs r ON r.id = l.run_id AND r.status = 'running'
            ORDER BY l.run_id, l.sequence_no DESC
            """, nativeQuery = true)
    java.util.List<LatestLogProjection> latestPerRunningRun();
}
