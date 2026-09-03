package com.hackathon.backend.dto;

import com.hackathon.backend.entity.Team;

/** Khong bao gio tra password_hash ra ngoai. */
public record TeamResponse(
        Integer id,
        String teamName,
        String carId,
        String username,
        String note,
        String macAddress,
        boolean active,
        Long createdAt) {

    public static TeamResponse from(Team t) {
        Long created = t.getCreatedAt() != null ? t.getCreatedAt().toEpochMilli() : null;
        return new TeamResponse(t.getId(), t.getTeamName(), t.getCarId(),
                t.getUsername(), t.getNote(), t.getMacAddress(), t.isActive(), created);
    }
}
