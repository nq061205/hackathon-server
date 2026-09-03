package com.hackathon.backend.service;

import com.hackathon.backend.entity.AuditLog;
import com.hackathon.backend.repository.AuditLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Ghi nhat ky thao tac. Goi trong CUNG transaction voi thao tac sua du lieu
 * (Propagation.MANDATORY) de dam bao: sua du lieu ma quen ghi audit thi khong xay ra,
 * va neu thao tac roll back thi dong audit cung roll back theo.
 */
@Service
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    public AuditService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(String action, String tableName, String recordId, String detail) {
        AuditLog a = new AuditLog();
        a.setAdminUser(SecurityUtil.currentUsername());
        a.setAction(action);
        a.setTableName(tableName);
        a.setRecordId(recordId);
        a.setDetail(detail);
        a.setCreatedAt(Instant.now());
        auditLogRepository.save(a);
    }
}
