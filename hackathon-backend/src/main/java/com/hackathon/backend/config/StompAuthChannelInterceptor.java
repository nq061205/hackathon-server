package com.hackathon.backend.config;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Chan (SUBSCRIBE) cac topic /topic/admin/** neu client khong phai role
 * admin — dung y het tinh than SecurityConfig chan /api/audit/** o REST
 * (chi admin doc duoc audit log). Role lay tu session attributes da luu luc
 * handshake (xem JwtHandshakeInterceptor).
 */
@Component
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            String destination = accessor.getDestination();
            if (destination != null && destination.startsWith("/topic/admin/")) {
                Map<String, Object> attrs = accessor.getSessionAttributes();
                String role = attrs != null ? String.valueOf(attrs.get("role")) : null;
                if (!"admin".equalsIgnoreCase(role)) {
                    throw new MessageDeliveryException(message,
                            "Khong co quyen subscribe " + destination);
                }
            }
        }
        return message;
    }
}
