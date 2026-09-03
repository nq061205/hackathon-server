package com.hackathon.backend.config;

import org.springframework.jdbc.datasource.lookup.AbstractRoutingDataSource;

/**
 * Chon datasource (app_admin hay app_viewer) theo gia tri trong
 * DataSourceContextHolder khi Spring xin connection cho transaction.
 */
public class RoutingDataSource extends AbstractRoutingDataSource {

    @Override
    protected Object determineCurrentLookupKey() {
        return DataSourceContextHolder.get();
    }
}
