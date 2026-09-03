package com.hackathon.backend.service;

import com.hackathon.backend.dto.TeamResponse;
import com.hackathon.backend.dto.TeamUpdateRequest;
import com.hackathon.backend.entity.Team;
import com.hackathon.backend.exception.ApiException;
import com.hackathon.backend.repository.TeamRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Quan tri teams. Theo yeu cau: KHONG them, KHONG xoa doi (10-15 doi cau hinh san).
 * Chi doc + bat/tat is_active = cap / thu hoi quyen truy cap WiFi cua tung doi
 * (dung tinh than WPA2-Enterprise: thu hoi mot doi ma khong anh huong cac doi khac).
 */
@Service
public class TeamService {

    // AA:BB:CC:DD:EE:FF - hoa hoac thuong, dung dau ':' (chuan hien thi pho bien nhat).
    private static final Pattern MAC_PATTERN = Pattern.compile("^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$");

    private final TeamRepository teamRepository;
    private final AuditService auditService;

    public TeamService(TeamRepository teamRepository, AuditService auditService) {
        this.teamRepository = teamRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<TeamResponse> list() {
        return teamRepository.findAllByOrderByIdAsc().stream().map(TeamResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public TeamResponse get(Integer id) {
        return TeamResponse.from(load(id));
    }

    private Team load(Integer id) {
        return teamRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Khong tim thay doi id=" + id));
    }

    @Transactional
    public TeamResponse update(Integer id, TeamUpdateRequest req) {
        Team t = load(id);
        StringBuilder detail = new StringBuilder();

        if (req.note() != null) {
            t.setNote(req.note());
            detail.append("note='").append(req.note()).append("' ");
        }
        if (req.macAddress() != null) {
            String mac = req.macAddress().isBlank() ? null : req.macAddress().trim();
            if (mac != null && !MAC_PATTERN.matcher(mac).matches()) {
                throw ApiException.badRequest("Dia chi MAC khong hop le, dung dinh dang AA:BB:CC:DD:EE:FF");
            }
            t.setMacAddress(mac);
            detail.append("mac_address='").append(mac).append("' ");
        }
        if (req.active() != null && req.active() != t.isActive()) {
            t.setActive(req.active());
            detail.append("is_active=").append(req.active()).append(' ');
        }

        teamRepository.save(t);
        auditService.record("UPDATE", "teams", String.valueOf(id),
                detail.length() == 0 ? "khong doi truong nao" : detail.toString().trim());
        return TeamResponse.from(t);
    }

    /** Thu hoi quyen WiFi cua mot doi (is_active=false). */
    @Transactional
    public TeamResponse revoke(Integer id) {
        Team t = load(id);
        if (!t.isActive()) {
            throw ApiException.conflict("Doi id=" + id + " von da bi thu hoi quyen");
        }
        t.setActive(false);
        teamRepository.save(t);
        auditService.record("UPDATE", "teams", String.valueOf(id),
                "thu hoi quyen WiFi (is_active=false), username=" + t.getUsername());
        return TeamResponse.from(t);
    }

    /** Cap lai quyen WiFi cho mot doi (is_active=true). */
    @Transactional
    public TeamResponse restore(Integer id) {
        Team t = load(id);
        if (t.isActive()) {
            throw ApiException.conflict("Doi id=" + id + " dang co quyen, khong can cap lai");
        }
        t.setActive(true);
        teamRepository.save(t);
        auditService.record("UPDATE", "teams", String.valueOf(id),
                "cap lai quyen WiFi (is_active=true), username=" + t.getUsername());
        return TeamResponse.from(t);
    }
}
