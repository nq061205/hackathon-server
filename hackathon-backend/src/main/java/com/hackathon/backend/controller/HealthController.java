package com.hackathon.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Endpoint "song hay chet" cho backend — KHONG can dang nhap (permitAll trong
 * SecurityConfig). Dung boi:
 *  - Man hinh "Dang khoi dong backend..." o frontend (xem
 *    src/components/BackendGate.jsx): sau khi mo ban .exe, Electron mo cua so
 *    ngay lap tuc nhung Spring Boot mat vai giay de khoi dong xong (doc
 *    config, ket noi DB, mo cong 8080) - frontend tu goi lien tuc endpoint
 *    nay cho toi khi thanh cong roi moi hien man hinh dang nhap/dashboard
 *    that, tranh loi "MAT KET NOI" gia lap luc khoi dong.
 *  - Kiem tra nhanh tu xa (vd tu may khac trong LAN) xem server co dang chay
 *    khong, ma khong can tai khoan.
 * KHONG lo du lieu nhay cam - chi tra ve "ok".
 */
@RestController
public class HealthController {

    @GetMapping("/api/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }
}
