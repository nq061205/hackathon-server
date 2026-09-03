package com.hackathon.backend.dto;

/** Dong mot luot: gan status='finished'. result la chuoi JSON tuy y (co the null). */
public record RunFinishRequest(String result, String note) {
}
