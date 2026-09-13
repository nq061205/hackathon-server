package com.hackathon.backend.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final LoginRateLimitFilter loginRateLimitFilter;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter, LoginRateLimitFilter loginRateLimitFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.loginRateLimitFilter = loginRateLimitFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsSource()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/login").permitAll()
                        .requestMatchers("/actuator/health", "/error").permitAll()
                        // "Song hay chet" cho backend, khong can dang nhap - dung boi
                        // man hinh "Dang khoi dong backend..." o frontend desktop
                        // (xem HealthController + src/components/BackendGate.jsx).
                        .requestMatchers("/api/health").permitAll()
                        // Rieng cho carlogd tren xe: KHONG dung JWT admin/viewer, tu xac
                        // thuc bang header X-Car-Api-Key ngay trong CarStatusController
                        // (chi tra dung trang thai cua DUNG doi trong URL - xem class do).
                        .requestMatchers(HttpMethod.GET, "/api/teams/*/car-status").permitAll()
                        // Handshake WebSocket (STOMP/SockJS): tu kiem tra JWT rieng
                        // qua query param trong JwtHandshakeInterceptor, khong dua
                        // vao Spring Security cho HTTP handshake nay.
                        .requestMatchers("/ws/**").permitAll()
                        // Ghi du lieu: chi admin.
                        .requestMatchers(HttpMethod.POST, "/api/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/**").hasRole("ADMIN")
                        // Audit: chi admin doc.
                        .requestMatchers("/api/audit/**").hasRole("ADMIN")
                        // Con lai (GET teams/runs/stats): admin hoac viewer.
                        .anyRequest().authenticated())
                // Thu tu QUAN TRONG: rate limit khai TRUOC nen chay TRUOC jwtAuthFilter
                // (hai filter cung moc UsernamePasswordAuthenticationFilter thi giu
                // nguyen thu tu khai bao). Chan tu som, khong ton cong verify bcrypt
                // cho request da vuot nguong.
                // Luu y: moc phai la filter co san cua Spring Security - dung filter
                // tu viet lam moc se loi "does not have a registered order".
                .addFilterBefore(loginRateLimitFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    private CorsConfigurationSource corsSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        // LUU Y: khong dung "*" tran o day. Ket hop allowedOriginPatterns("*")
        // (dau * TRAN, khong phai pattern that su) voi allowCredentials(true)
        // khien Spring khong xac dinh duoc origin cu the de phan chieu lai,
        // nen tra ve Access-Control-Allow-Credentials RONG thay vi "true" —
        // trinh duyet chan luon SockJS/WebSocket voi loi CORS. Dung pattern
        // that su (co dau * o giua/cuoi) de Spring phan chieu dung origin.
        // Them cong khac vao day neu frontend/electron dev chay o cong moi.
        // "file://*": ban Electron DA DONG GOI (.exe) mo trang bang loadFile()
        // (khac che do dev dung loadURL("http://localhost:3010")) nen Origin
        // cua trang la "file://" - thieu dong nay thi API/WebSocket tu ban
        // dong goi bi CORS chan het, hien "MAT KET NOI" du backend van chay.
        cfg.setAllowedOriginPatterns(List.of(
                "http://localhost:*",
                "http://127.0.0.1:*",
                "file://*"));
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        // SockJS (dung boi WebSocket /ws) tu gui request kem credentials
        // (withCredentials=true) cho vai transport fallback (xhr-streaming...) —
        // trinh duyet se chan neu server khong tra ve
        // Access-Control-Allow-Credentials: true.
        cfg.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }
}
