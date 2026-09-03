package com.hackathon.backend.dto;

import com.hackathon.backend.entity.AuditLog;

public record AuditResponse(
        Integer id,
        String adminUser,
        String action,
        String tableName,
        String recordId,
        String detail,
        Long createdAt) {

    public static AuditResponse from(AuditLog a) {
        Long created = a.getCreatedAt() != null ? a.getCreatedAt().toEpochMilli() : null;
        return new AuditResponse(a.getId(), a.getAdminUser(), a.getAction(),
                a.getTableName(), a.getRecordId(), a.getDetail(), created);
    }
}
