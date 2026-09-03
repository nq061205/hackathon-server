package com.hackathon.backend.entity;

import java.io.Serializable;
import java.util.Objects;

/** Khoa chinh ghep cua bang logs: (run_id, sequence_no). */
public class LogId implements Serializable {

    private Integer runId;
    private Long sequenceNo;

    public LogId() {
    }

    public LogId(Integer runId, Long sequenceNo) {
        this.runId = runId;
        this.sequenceNo = sequenceNo;
    }

    public Integer getRunId() { return runId; }
    public void setRunId(Integer runId) { this.runId = runId; }

    public Long getSequenceNo() { return sequenceNo; }
    public void setSequenceNo(Long sequenceNo) { this.sequenceNo = sequenceNo; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        LogId logId = (LogId) o;
        return Objects.equals(runId, logId.runId) && Objects.equals(sequenceNo, logId.sequenceNo);
    }

    @Override
    public int hashCode() {
        return Objects.hash(runId, sequenceNo);
    }
}
