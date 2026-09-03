package com.hackathon.backend.service;

import org.springframework.security.core.context.SecurityContextHolder;

/** Lay username cua nguoi dang dang nhap tu SecurityContext (subject cua JWT). */
public final class SecurityUtil {

    private SecurityUtil() {
    }

    public static String currentUsername() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? String.valueOf(auth.getName()) : "unknown";
    }
}
