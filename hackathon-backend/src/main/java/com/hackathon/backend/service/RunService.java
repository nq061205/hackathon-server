package com.hackathon.backend.service;

import com.hackathon.backend.dto.*;
import com.hackathon.backend.entity.Run;
import com.hackathon.backend.entity.Team;
import com.hackathon.backend.exception.ApiException;
import com.hackathon.backend.repository.RunRepository;
import com.hackathon.backend.repository.TeamRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class RunService {

    private final RunRepository runRepository;
    private final TeamRepository teamRepository;
    private final AuditService auditService;

    public RunService(RunRepository runRepository, TeamRepository teamRepository, AuditService auditService) {
        this.runRepository = runRepository;
        this.teamRepository = teamRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<RunResponse> list(String status) {
        List<Run> runs = (status == null || status.isBlank())
                ? runRepository.findAllByOrderByStartedAtDesc()
                : runRepository.findByStatusOrderByStartedAtDesc(status);
        return runs.stream().map(RunResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public RunResponse get(Integer id) {
        return RunResponse.from(load(id));
    }

    @Transactional(readOnly = true)
    public List<RunResponse> byTeam(Integer teamId) {
        return runRepository.findByTeamIdOrderByHeatNoAsc(teamId).stream().map(RunResponse::from).toList();
    }

    private Run load(Integer id) {
        return runRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Khong tim thay luot chay id=" + id));
    }

    @Transactional
    public RunResponse open(RunCreateRequest req) {
        Team team = teamRepository.findById(req.teamId())
                .orElseThrow(() -> ApiException.notFound("Khong tim thay doi id=" + req.teamId()));

        int heat = runRepository.nextHeatNo(team.getId());
        Run r = new Run();
        r.setTeamId(team.getId());
        r.setHeatNo(heat);
        r.setStartedAt(Instant.now());
        r.setStatus("running");
        r.setNote(req.note());
        runRepository.save(r);

        auditService.record("INSERT", "runs", String.valueOf(r.getId()),
                "mo luot chay heat_no=" + heat + " cho doi id=" + team.getId());
        return RunResponse.from(r);
    }

    @Transactional
    public RunResponse finish(Integer id, RunFinishRequest req) {
        Run r = load(id);
        if (!"running".equals(r.getStatus())) {
            throw ApiException.conflict("Chi dong duoc luot dang 'running' (hien tai: " + r.getStatus() + ")");
        }
        r.setStatus("finished");
        r.setEndedAt(Instant.now());
        if (req != null && req.result() != null) r.setResult(req.result());
        if (req != null && req.note() != null) r.setNote(req.note());
        runRepository.save(r);

        auditService.record("UPDATE", "runs", String.valueOf(id), "ket thuc luot (status=finished)");
        return RunResponse.from(r);
    }

    @Transactional
    public RunResponse voidRun(Integer id, RunVoidRequest req) {
        Run r = load(id);
        if ("unscored".equals(r.getStatus())) {
            throw ApiException.conflict("Luot id=" + id + " von da bi huy");
        }
        r.setStatus("unscored");
        if (r.getEndedAt() == null) r.setEndedAt(Instant.now());
        if (req != null && req.note() != null) r.setNote(req.note());
        runRepository.save(r);

        auditService.record("UPDATE", "runs", String.valueOf(id),
                "huy luot (status=unscored)" + (req != null && req.note() != null ? ", ly do: " + req.note() : ""));
        return RunResponse.from(r);
    }
}
