package com.hackathon.backend.entity;

import jakarta.persistence.*;
import java.time.Instant;

/** Nhat ky thao tac: ghi mot dong moi khi admin sua teams / runs. Chi them, khong sua/xoa. created_at: TIMESTAMPTZ -> Instant. */
@Entity
@Table(name = "audit_log")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "admin_user", nullable = false)
    private String adminUser;

    @Column(name = "action", nullable = false)
    private String action;

    @Column(name = "table_name", nullable = false)
    private String tableName;

    @Column(name = "record_id")
    private String recordId;

    @Column(name = "detail")
    private String detail;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }

    public String getAdminUser() { return adminUser; }
    public void setAdminUser(String adminUser) { this.adminUser = adminUser; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public String getTableName() { return tableName; }
    public void setTableName(String tableName) { this.tableName = tableName; }

    public String getRecordId() { return recordId; }
    public void setRecordId(String recordId) { this.recordId = recordId; }

    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
