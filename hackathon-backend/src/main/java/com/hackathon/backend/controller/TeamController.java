package com.hackathon.backend.controller;

import com.hackathon.backend.dto.TeamResponse;
import com.hackathon.backend.dto.TeamUpdateRequest;
import com.hackathon.backend.service.TeamService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Quan tri teams. GET: admin + viewer. Cac thao tac sua: chi admin
 * (SecurityConfig chan theo HTTP method).
 * KHONG co endpoint tao/xoa doi theo yeu cau (10-15 doi cau hinh san).
 */
@RestController
@RequestMapping("/api/teams")
public class TeamController {

    private final TeamService teamService;

    public TeamController(TeamService teamService) {
        this.teamService = teamService;
    }

    @GetMapping
    public List<TeamResponse> list() {
        return teamService.list();
    }

    @GetMapping("/{id}")
    public TeamResponse get(@PathVariable Integer id) {
        return teamService.get(id);
    }

    @PatchMapping("/{id}")
    public TeamResponse update(@PathVariable Integer id, @Valid @RequestBody TeamUpdateRequest req) {
        return teamService.update(id, req);
    }

    /** Thu hoi quyen truy cap WiFi cua mot doi (is_active=false). */
    @PostMapping("/{id}/revoke")
    public TeamResponse revoke(@PathVariable Integer id) {
        return teamService.revoke(id);
    }

    /** Cap lai quyen truy cap WiFi cho mot doi (is_active=true). */
    @PostMapping("/{id}/restore")
    public TeamResponse restore(@PathVariable Integer id) {
        return teamService.restore(id);
    }
}
