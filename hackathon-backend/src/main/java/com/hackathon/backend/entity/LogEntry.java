package com.hackathon.backend.entity;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Log thi dau (gui ~10ms/goi tu xe). Chi doc trong backend nay —
 * viec ghi do dich vu ingest (Python) dam nhan. KHONG sua/xoa.
 * car_timestamp / received_at: TIMESTAMPTZ -> Instant (theo schema init_basic_int.txt).
 */
@Entity
@Table(name = "logs")
@IdClass(LogId.class)
public class LogEntry {

    @Id
    @Column(name = "run_id", nullable = false)
    private Integer runId;

    @Id
    @Column(name = "sequence_no", nullable = false)
    private Long sequenceNo;

    @Column(name = "team_id", nullable = false)
    private Integer teamId;

    @Column(name = "car_timestamp", nullable = false)
    private Instant carTimestamp;

    @Column(name = "received_at", nullable = false)
    private Instant receivedAt;

    @Column(name = "ai_result", nullable = false)
    private String aiResult;

    public Integer getRunId() { return runId; }
    public void setRunId(Integer runId) { this.runId = runId; }

    public Long getSequenceNo() { return sequenceNo; }
    public void setSequenceNo(Long sequenceNo) { this.sequenceNo = sequenceNo; }

    public Integer getTeamId() { return teamId; }
    public void setTeamId(Integer teamId) { this.teamId = teamId; }

    public Instant getCarTimestamp() { return carTimestamp; }
    public void setCarTimestamp(Instant carTimestamp) { this.carTimestamp = carTimestamp; }

    public Instant getReceivedAt() { return receivedAt; }
    public void setReceivedAt(Instant receivedAt) { this.receivedAt = receivedAt; }

    public String getAiResult() { return aiResult; }
    public void setAiResult(String aiResult) { this.aiResult = aiResult; }
}
