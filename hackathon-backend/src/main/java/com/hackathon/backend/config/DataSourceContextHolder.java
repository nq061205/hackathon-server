package com.hackathon.backend.config;

/**
 * Giu role ket noi DB cho request hien tai (theo tung thread).
 * Mac dinh ADMIN: endpoint login can doc bang app_users ma app_viewer khong co quyen.
 */
public final class DataSourceContextHolder {

    private static final ThreadLocal<DataSourceRole> CONTEXT = new ThreadLocal<>();

    private DataSourceContextHolder() {
    }

    public static void set(DataSourceRole role) {
        CONTEXT.set(role);
    }

    public static DataSourceRole get() {
        DataSourceRole role = CONTEXT.get();
        return role == null ? DataSourceRole.ADMIN : role;
    }

    public static void clear() {
        CONTEXT.remove();
    }
}
