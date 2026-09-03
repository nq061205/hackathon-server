package com.hackathon.backend.dto;

import org.springframework.data.domain.Page;

import java.util.List;

/** Bao boc phan trang gon, on dinh JSON (khong phu thuoc dinh dang Page cua Spring). */
public record PageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages) {

    public static <E, T> PageResponse<T> of(Page<E> page, List<T> content) {
        return new PageResponse<>(content, page.getNumber(), page.getSize(),
                page.getTotalElements(), page.getTotalPages());
    }
}
