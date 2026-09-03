package com.hackathon.backend.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Doc JWT tu header Authorization, dat Authentication + chon role ket noi DB.
 * Vien 'viewer' -> dung ket noi app_viewer; con lai (ke ca login chua co token)
 * -> app_admin. Xoa ThreadLocal cuoi request de khong ro ri sang request khac.
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    public JwtAuthFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain)
            throws ServletException, IOException {
        try {
            String header = request.getHeader("Authorization");
            if (header != null && header.startsWith("Bearer ")) {
                String token = header.substring(7);
                try {
                    Claims claims = jwtService.parse(token);
                    String username = claims.getSubject();
                    String role = String.valueOf(claims.get("role"));

                    String authority = "ROLE_" + role.toUpperCase();
                    var auth = new UsernamePasswordAuthenticationToken(
                            username, null, List.of(new SimpleGrantedAuthority(authority)));
                    auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(auth);

                    DataSourceContextHolder.set("viewer".equalsIgnoreCase(role)
                            ? DataSourceRole.VIEWER : DataSourceRole.ADMIN);
                } catch (JwtException | IllegalArgumentException ex) {
                    // Token khong hop le -> de nguyen chua xac thuc, security se tra 401.
                    SecurityContextHolder.clearContext();
                }
            }
            filterChain.doFilter(request, response);
        } finally {
            DataSourceContextHolder.clear();
        }
    }
}
