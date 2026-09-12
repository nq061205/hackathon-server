package com.hackathon.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket (STOMP qua SockJS) de day du lieu dong bo toi MOI client dang mo
 * app cung luc — kieu he thong TCDS cua pit wall F1 (server gom du lieu 1
 * lan roi phat cho tat ca, thay vi moi cua so tu poll REST rieng theo dong
 * ho cua no). Xem ws.RaceDataBroadcaster / ws.AuditBroadcaster (ben phat) va
 * hooks/useRaceData.js ben frontend (ben nhan).
 *
 * Xac thuc bang JWT truyen qua query param luc handshake
 * (JwtHandshakeInterceptor)
 * vi trinh duyet khong gan duoc header Authorization tuy y vao WebSocket
 * handshake. SecurityConfig da permitAll() duong /ws/** (tu kiem tra token
 * o day, khong dua vao Spring Security cho HTTP handshake).
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtHandshakeInterceptor jwtHandshakeInterceptor;
    private final StompAuthChannelInterceptor stompAuthChannelInterceptor;

    public WebSocketConfig(JwtHandshakeInterceptor jwtHandshakeInterceptor,
            StompAuthChannelInterceptor stompAuthChannelInterceptor) {
        this.jwtHandshakeInterceptor = jwtHandshakeInterceptor;
        this.stompAuthChannelInterceptor = stompAuthChannelInterceptor;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Cung khong dung "*" tran o day - ly do xem chu thich trong
        // SecurityConfig.corsSource() (dau * tran + credentials=true khien
        // SockJS tra ve Access-Control-Allow-Credentials rong). Them cong
        // khac vao day neu frontend/electron dev chay o cong moi.
        //
        // "file://*": BAT BUOC cho ban Electron DA DONG GOI (.exe) - khac voi
        // che do dev (mainWindow.loadURL("http://localhost:3010")), ban dong
        // goi mo trang bang loadFile() (xem electron/main.cjs) nen trinh duyet
        // trong Electron coi Origin cua trang la "file://" - thieu pattern nay
        // thi SockJS/WebSocket bi chan tu buoc handshake, hien "MAT KET NOI"
        // vinh vien du backend van chay binh thuong.
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("http://localhost:*", "http://127.0.0.1:*", "file://*")
                .addInterceptors(jwtHandshakeInterceptor)
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Chi server -> client (broadcast), khong nhan lenh tu client nen
        // khong can khai bao application destination prefix ("/app").
        registry.enableSimpleBroker("/topic");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(stompAuthChannelInterceptor);
    }
}
