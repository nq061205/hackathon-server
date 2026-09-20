package com.hackathon.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Backend quan tri cuoc thi dua xe.
 *
 * Loai bo DataSourceAutoConfiguration mac dinh vi ta tu cau hinh HAI datasource
 * (app_admin / app_viewer) va mot RoutingDataSource dinh tuyen theo role.
 *
 * @EnableScheduling: can cho ws.RaceDataBroadcaster / ws.AuditBroadcaster
 * (@Scheduled moi 500ms de day du lieu qua WebSocket).
 */
@SpringBootApplication(exclude = { DataSourceAutoConfiguration.class })
@EnableScheduling
public class BackendApplication {
    public static void main(String[] args) {
        SpringApplication.run(BackendApplication.class, args);
    }
}
