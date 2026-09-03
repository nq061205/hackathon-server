package com.hackathon.backend.dto;

import jakarta.validation.constraints.NotNull;

/** Mo mot luot chay moi cho mot doi. heat_no do backend tu tinh (max + 1). */
public record RunCreateRequest(
        @NotNull Integer teamId,
        String note) {
}
