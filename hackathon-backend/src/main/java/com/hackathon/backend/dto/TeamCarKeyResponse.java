package com.hackathon.backend.dto;

/**
 * Phan hoi CHI cho POST /api/teams/{id}/car-api-key - la LAN DUY NHAT chia
 * khoa moi duoc tra ve o dang chu (giong nt_hash/password, khong bao gio
 * doc lai duoc qua GET /api/teams). Admin phai copy ngay luc nay vao
 * config.py (CARLOGD_API_KEY) tren xe cua dung doi - bam nut lan nua se
 * SINH KHOA MOI (khoa cu het hieu luc ngay).
 */
public record TeamCarKeyResponse(Integer teamId, String carApiKey) {
}
