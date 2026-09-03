package com.hackathon.backend.dto;

public record LoginResponse(
        String token,
        String username,
        String fullName,
        String role,
        long expiresInMinutes) {
}
