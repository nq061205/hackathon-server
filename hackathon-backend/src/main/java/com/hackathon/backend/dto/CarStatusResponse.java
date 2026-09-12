package com.hackathon.backend.dto;

/**
 * Phan hoi toi thieu cho GET /api/teams/{id}/car-status - carlogd tren xe
 * CHI can 2 truong nay de tu quyet dinh co START hay khong. Co tinh de
 * KHONG chua bat ky thong tin nao cua doi khac hay du lieu telemetry/log -
 * du chia khoa car_api_key bi lo, thi sinh cung chi doc duoc dung 2 gia
 * tri nay cho DUNG doi cua ho.
 */
public record CarStatusResponse(Integer runId, Long carStartRequestedAt) {
}
