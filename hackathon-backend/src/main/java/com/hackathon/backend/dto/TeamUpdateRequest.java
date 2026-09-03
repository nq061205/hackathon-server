package com.hackathon.backend.dto;

/**
 * Cap nhat mot doi. Chi cho phep doi ghi chu, dia chi MAC va bat/tat quyen WiFi (is_active).
 * Khong cho doi ten/username/car_id de tranh lech voi cau hinh RADIUS da cai.
 * Cac truong null = khong doi. macAddress = "" (chuoi rong) -> xoa MAC da luu.
 */
public record TeamUpdateRequest(
        String note,
        String macAddress,
        Boolean active) {
}
