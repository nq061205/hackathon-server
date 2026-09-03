package com.hackathon.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;

/**
 * Backend quan tri cuoc thi dua xe.
 *
 * Loai bo DataSourceAutoConfiguration mac dinh vi ta tu cau hinh HAI datasource
 * (app_admin / app_viewer) va mot RoutingDataSource dinh tuyen theo role.
 */
@SpringBootApplication(exclude = { DataSourceAutoConfiguration.class })
public class BackendApplication {
    public static void main(String[] args) {
        SpringApplication.run(BackendApplication.class, args);
    }
}
