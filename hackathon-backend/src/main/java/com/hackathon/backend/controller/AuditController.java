package com.hackathon.backend.controller;

import com.hackathon.backend.dto.AuditResponse;
import com.hackathon.backend.dto.PageResponse;
import com.hackathon.backend.entity.AuditLog;
import com.hackathon.backend.repository.AuditLogRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Nhat ky thao tac — chi admin (SecurityConfig chan /api/audit/**). */
@RestController
@RequestMapping("/api/audit")
public class AuditController {

    private final AuditLogRepository auditLogRepository;

    public AuditController(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public PageResponse<AuditResponse> list(@RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "50") int size) {
        int safeSize = Math.min(Math.max(size, 1), 500);
        Page<AuditLog> p = auditLogRepository.findAllByOrderByCreatedAtDesc(
                PageRequest.of(Math.max(page, 0), safeSize));
        List<AuditResponse> content = p.getContent().stream().map(AuditResponse::from).toList();
        return PageResponse.of(p, content);
    }
}
