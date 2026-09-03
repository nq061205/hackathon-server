package com.hackathon.backend.repository;

import com.hackathon.backend.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditLogRepository extends JpaRepository<AuditLog, Integer> {
    Page<AuditLog> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
