package com.hackathon.backend.entity;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Mot luot chay cua mot doi. status: running / finished / unscored.
 * Huy luot = dat status='unscored' (KHONG xoa log). Moc thoi gian: TIMESTAMPTZ -> Instant.
 */
@Entity
@Table(name = "runs")
public class Run {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "team_id", nullable = false)
    private Integer teamId;

    @Column(name = "heat_no", nullable = false)
    private Integer heatNo;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "result")
    private String result;

    @Column(name = "note")
    private String note;

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }

    public Integer getTeamId() { return teamId; }
    public void setTeamId(Integer teamId) { this.teamId = teamId; }

    public Integer getHeatNo() { return heatNo; }
    public void setHeatNo(Integer heatNo) { this.heatNo = heatNo; }

    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }

    public Instant getEndedAt() { return endedAt; }
    public void setEndedAt(Instant endedAt) { this.endedAt = endedAt; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getResult() { return result; }
    public void setResult(String result) { this.result = result; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}
