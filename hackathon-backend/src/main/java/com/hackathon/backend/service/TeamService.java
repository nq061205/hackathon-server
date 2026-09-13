package com.hackathon.backend.service;

import com.hackathon.backend.dto.TeamCarKeyResponse;
import com.hackathon.backend.dto.TeamResponse;
import com.hackathon.backend.dto.TeamUpdateRequest;
import com.hackathon.backend.entity.Team;
import com.hackathon.backend.exception.ApiException;
import com.hackathon.backend.repository.TeamRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.HexFormat;
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

    // CSPRNG that su (KHONG dung Postgres random(), khong dam bao chuan
    // crypto) - dung sinh car_api_key, moi lan bam nut ra 1 chia khoa moi
    // 32 byte (64 ky tu hex), khong the doan truoc.
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

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

    /**
     * Sinh MOI chia khoa car_api_key cho 1 doi (dung cho carlogd tren xe goi
     * GET /api/teams/{id}/car-status - xem CarStatusController). Thay the
     * viec admin phai tu go UPDATE ... SET car_api_key = ... bang SQL: nut
     * bam tren web nay dung ngay cho ca 10-15 doi, khong can ai biet SQL,
     * va dung CSPRNG that su thay vi md4/random() cua Postgres.
     *
     * Chia khoa CU mat hieu luc ngay khi sinh khoa moi - neu bam nham sau
     * khi xe da chay on dinh, phai cap nhat lai config.py tren xe cho khop.
     */
    @Transactional
    public TeamCarKeyResponse regenerateCarApiKey(Integer id) {
        Team t = load(id);
        byte[] raw = new byte[32];
        SECURE_RANDOM.nextBytes(raw);
        String key = HexFormat.of().formatHex(raw);
        t.setCarApiKey(key);
        teamRepository.save(t);
        auditService.record("UPDATE", "teams", String.valueOf(id),
                "sinh moi car_api_key cho xe (khoa cu, neu co, het hieu luc)");
        return new TeamCarKeyResponse(id, key);
    }
}
