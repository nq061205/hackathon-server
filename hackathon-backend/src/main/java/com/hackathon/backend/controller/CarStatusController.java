package com.hackathon.backend.controller;

import com.hackathon.backend.dto.CarStatusResponse;
import com.hackathon.backend.entity.Run;
import com.hackathon.backend.entity.Team;
import com.hackathon.backend.exception.ApiException;
import com.hackathon.backend.repository.RunRepository;
import com.hackathon.backend.repository.TeamRepository;
import org.springframework.web.bind.annotation.*;

/**
 * Endpoint RIENG cho carlogd tren xe - KHONG dung he JWT admin/viewer.
 * Xac thuc bang header X-Car-Api-Key, so khop dung teams.car_api_key cua
 * CHINH id trong URL (xem SecurityConfig - path nay permitAll o tang
 * Spring Security, tu kiem tra quyen ngay trong method).
 *
 * Vi sao tach rieng khoi TeamController/StatsController (thay vi tai su
 * dung tai khoan "viewer" nhu ban dau): tai khoan viewer/JWT co quyen doc
 * MOI doi (GET /api/runs, /api/runs/{id}/logs...), khong gioi han theo
 * team_id - neu lo (thi sinh doc duoc trong config.py tren xe cua ho) se
 * xem duoc du lieu chi tiet cua CA doi khac, mat cong bang. Endpoint nay
 * chi tra dung 2 truong toi thieu (xem CarStatusResponse) va chi cho DUNG
 * id trong URL nen du lo cung khong ro ri gi ve doi khac.
 */
@RestController
@RequestMapping("/api/teams")
public class CarStatusController {

    private final TeamRepository teamRepository;
    private final RunRepository runRepository;

    public CarStatusController(TeamRepository teamRepository, RunRepository runRepository) {
        this.teamRepository = teamRepository;
        this.runRepository = runRepository;
    }

    @GetMapping("/{id}/car-status")
    public CarStatusResponse carStatus(@PathVariable Integer id,
                                        @RequestHeader(value = "X-Car-Api-Key", required = false) String apiKey) {
        Team team = teamRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Khong tim thay doi id=" + id));

        if (apiKey == null || apiKey.isBlank()
                || team.getCarApiKey() == null
                || !team.getCarApiKey().equals(apiKey)) {
            // Co tinh khong noi ro "sai key" hay "doi khong ton tai car_api_key"
            // de tranh do tham dua doi (giong cach RADIUS tra loi chung chung).
            throw ApiException.forbidden("Sai hoac thieu X-Car-Api-Key cho doi id=" + id);
        }
        if (!team.isActive()) {
            throw ApiException.forbidden("Doi id=" + id + " dang bi thu hoi quyen (is_active=false)");
        }

        Run run = runRepository.findFirstByTeamIdAndStatusOrderByIdDesc(id, "running").orElse(null);
        Long requestedAt = (run != null && run.getCarStartRequestedAt() != null)
                ? run.getCarStartRequestedAt().toEpochMilli() : null;
        return new CarStatusResponse(run != null ? run.getId() : null, requestedAt);
    }
}
