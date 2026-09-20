package com.hackathon.backend.ws;

import com.hackathon.backend.dto.AuditResponse;
import com.hackathon.backend.dto.PageResponse;
import com.hackathon.backend.entity.AuditLog;
import com.hackathon.backend.repository.AuditLogRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Day nhat ky thao tac (audit log) qua WebSocket cho tab Quan tri — rieng
 * topic /topic/admin/audit, StompAuthChannelInterceptor chan viewer
 * subscribe (chi admin xem duoc, giong SecurityConfig chan /api/audit/**
 * o REST).
 */
@Component
public class AuditBroadcaster {

    private final SimpMessagingTemplate messagingTemplate;
    private final AuditLogRepository auditLogRepository;

    public AuditBroadcaster(SimpMessagingTemplate messagingTemplate, AuditLogRepository auditLogRepository) {
        this.messagingTemplate = messagingTemplate;
        this.auditLogRepository = auditLogRepository;
    }

    @Scheduled(fixedRate = 500)
    @Transactional(readOnly = true)
    public void broadcast() {
        Page<AuditLog> p = auditLogRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, 12));
        List<AuditResponse> content = p.getContent().stream().map(AuditResponse::from).toList();
        messagingTemplate.convertAndSend("/topic/admin/audit", PageResponse.of(p, content));
    }
}
