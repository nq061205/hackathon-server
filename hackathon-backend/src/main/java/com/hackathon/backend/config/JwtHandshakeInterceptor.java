package com.hackathon.backend.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Xac thuc JWT luc handshake WebSocket (truoc khi ket noi thanh cong).
 * Token truyen qua query param ?token=... chu KHONG dung header Authorization
 * nhu REST, vi WebSocket API cua trinh duyet khong cho gan header tuy y luc
 * mo ket noi. Token hop le -> luu username/role vao session attributes de
 * StompAuthChannelInterceptor dung sau (chan subscribe topic admin-only).
 */
@Component
public class JwtHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtService jwtService;

    public JwtHandshakeInterceptor(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                    WebSocketHandler wsHandler, Map<String, Object> attributes) {
        String token = extractToken(request);
        if (token == null) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
        try {
            Claims claims = jwtService.parse(token);
            attributes.put("username", claims.getSubject());
            attributes.put("role", String.valueOf(claims.get("role")).toLowerCase());
            return true;
        } catch (JwtException | IllegalArgumentException ex) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                WebSocketHandler wsHandler, Exception exception) {
        // khong can lam gi them
    }

    private String extractToken(ServerHttpRequest request) {
        if (!(request instanceof ServletServerHttpRequest servletRequest)) return null;
        String query = servletRequest.getServletRequest().getQueryString();
        if (query == null) return null;
        for (String pair : query.split("&")) {
            int eq = pair.indexOf('=');
            if (eq > 0 && "token".equals(pair.substring(0, eq))) {
                return URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8);
            }
        }
        return null;
    }
}
