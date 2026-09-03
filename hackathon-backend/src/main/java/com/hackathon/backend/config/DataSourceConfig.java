package com.hackathon.backend.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.util.HashMap;
import java.util.Map;

/**
 * Dinh nghia hai HikariDataSource (app_admin / app_viewer) va mot
 * RoutingDataSource dat lam @Primary de JPA/Hibernate su dung.
 */
@Configuration
public class DataSourceConfig {

    @Value("${datasource.common.host}")
    private String host;
    @Value("${datasource.common.port}")
    private String port;
    @Value("${datasource.common.name}")
    private String dbName;

    @Value("${datasource.admin.user}")
    private String adminUser;
    @Value("${datasource.admin.password}")
    private String adminPassword;

    @Value("${datasource.viewer.user}")
    private String viewerUser;
    @Value("${datasource.viewer.password}")
    private String viewerPassword;

    private String jdbcUrl() {
        return "jdbc:postgresql://" + host + ":" + port + "/" + dbName;
    }

    private HikariDataSource build(String user, String password, String poolName, int maxPool) {
        HikariDataSource ds = DataSourceBuilder.create()
                .type(HikariDataSource.class)
                .driverClassName("org.postgresql.Driver")
                .url(jdbcUrl())
                .username(user)
                .password(password)
                .build();
        ds.setPoolName(poolName);
        ds.setMaximumPoolSize(maxPool);
        ds.setMinimumIdle(1);
        return ds;
    }

    @Bean
    public DataSource adminDataSource() {
        return build(adminUser, adminPassword, "pool-admin", 10);
    }

    @Bean
    public DataSource viewerDataSource() {
        return build(viewerUser, viewerPassword, "pool-viewer", 10);
    }

    @Bean
    @Primary
    public DataSource dataSource(DataSource adminDataSource, DataSource viewerDataSource) {
        RoutingDataSource routing = new RoutingDataSource();

        Map<Object, Object> targets = new HashMap<>();
        targets.put(DataSourceRole.ADMIN, adminDataSource);
        targets.put(DataSourceRole.VIEWER, viewerDataSource);

        routing.setTargetDataSources(targets);
        routing.setDefaultTargetDataSource(adminDataSource);
        routing.afterPropertiesSet();
        return routing;
    }
}
