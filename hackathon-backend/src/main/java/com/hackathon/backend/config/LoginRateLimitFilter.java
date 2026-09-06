package com.hackathon.backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Gioi han so lan goi POST /api/auth/login theo tung IP.
 *
 * VI SAO CHI RIENG ENDPOINT NAY: moi lan dang nhap phai verify bcrypt, ma
 * bcrypt CO Y cham (~100ms CPU/lan) de chong do mat khau. Diem manh do lai
 * thanh diem yeu khi bi tan cong: vai chuc request song song la dang CPU
 * backend, ca dashboard treo theo. Cac endpoint GET khac chi doc DB nen
 * re hon nhieu, khong can chan o day.
 *
 * Chan luon ca 2 kieu tan cong bang mot co che:
 *   - Do mat khau (brute force): 10 lan/phut thi khong do noi gi.
 *   - Lam nghen CPU (DoS): so lan verify bcrypt bi chan tran cung.
 *
 * Cua so co dinh 1 phut, dem theo IP. Don gian nhung du: khong can chinh xac
 * tuyet doi, chi can chan duoc do lon cua tan cong.
 */
@Component
public class LoginRateLimitFilter extends OncePerRequestFilter {

    private static final String LOGIN_PATH = "/api/auth/login";

    /** Toi da bao nhieu lan dang nhap moi phut cho MOT IP. */
    private final int maxPerMinute;

    /**
     * Tran kich thuoc than request dang nhap (byte).
     *
     * VI SAO CAN: /api/auth/login la endpoint DUY NHAT khong doi dang nhap,
     * va Spring KHONG gioi han kich thuoc than JSON mac dinh. Bo dem so lan o
     * tren chay TRUOC khi doc than, nen no chi chan duoc so luot chu khong
     * chan duoc dung luong: 10 request x 1GB van bi nuot het vao bo nho.
     * Mot goi dang nhap that chi vai tram byte, nen 4KB da rat rong rai.
     */
    private final int maxBodyBytes;

    /** Chan so IP theo doi cung luc, tranh phinh bo nho khi bi tan cong tu nhieu IP. */
    private static final int MAX_TRACKED_IPS = 10_000;

    private final Map<String, AtomicInteger> counts = new ConcurrentHashMap<>();
    private volatile long windowMinute = -1;

    public LoginRateLimitFilter(
            @Value("${app.login-rate-limit.max-per-minute:10}") int maxPerMinute,
            @Value("${app.login-rate-limit.max-body-bytes:4096}") int maxBodyBytes) {
        this.maxPerMinute = maxPerMinute;
        this.maxBodyBytes = maxBodyBytes;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        if (!isLoginRequest(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        String ip = request.getRemoteAddr();

        // (1) Than request qua lon -> tu choi TRUOC khi doc mot byte nao.
        // len < 0 nghia la client dung 'Transfer-Encoding: chunked', tuc KHONG
        // khai bao truoc do dai -> khong the kiem tran, va do cung la cach hien
        // nhien nhat de lach buoc kiem tra nay. Trinh duyet luon dat
        // Content-Length cho mot goi JSON, nen chan luon la an toan.
        long len = request.getContentLengthLong();
        if (maxBodyBytes > 0 && (len < 0 || len > maxBodyBytes)) {
            logger.warn("Chan dang nhap: IP " + ip + " gui than request "
                    + (len < 0 ? "khong khai bao do dai (chunked)" : len + " byte")
                    + ", tran la " + maxBodyBytes + " byte");
            reject(response, HttpStatus.PAYLOAD_TOO_LARGE, false,
                    "Du lieu gui len qua lon");
            return;
        }

        // (2) Qua nhieu lan trong mot phut -> tu choi, khong ton CPU verify bcrypt.
        if (maxPerMinute > 0 && !allow(ip)) {
            logger.warn("Chan dang nhap: IP " + ip + " vuot qua " + maxPerMinute + " lan/phut");
            reject(response, HttpStatus.TOO_MANY_REQUESTS, true,
                    "Qua nhieu lan dang nhap, thu lai sau 1 phut");
            return;
        }
        filterChain.doFilter(request, response);
    }

    private boolean isLoginRequest(HttpServletRequest request) {
        return "POST".equalsIgnoreCase(request.getMethod())
                && LOGIN_PATH.equals(request.getRequestURI());
    }

    /** true = cho di tiep, false = da vuot nguong trong phut nay. */
    private boolean allow(String ip) {
        long minute = System.currentTimeMillis() / 60_000L;
        if (minute != windowMinute) {   // sang phut moi -> xoa sach bo dem
            synchronized (this) {
                if (minute != windowMinute) {
                    counts.clear();
                    windowMinute = minute;
                }
            }
        }
        AtomicInteger c = counts.get(ip);
        if (c == null) {
            if (counts.size() >= MAX_TRACKED_IPS) {
                return false;           // bang day (dang bi tan cong dien rong) -> chan
            }
            c = counts.computeIfAbsent(ip, k -> new AtomicInteger());
        }
        return c.incrementAndGet() <= maxPerMinute;
    }

    /** Tra loi dung dinh dang loi chung cua ung dung (xem GlobalExceptionHandler). */
    private void reject(HttpServletResponse response, HttpStatus status,
                        boolean retryAfter, String message) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        if (retryAfter) {
            response.setHeader("Retry-After", "60");
        }
        String body = "{"
                + "\"timestamp\":\"" + Instant.now() + "\","
                + "\"status\":" + status.value() + ","
                + "\"error\":\"" + status.getReasonPhrase() + "\","
                + "\"message\":\"" + message + "\""
                + "}";
        response.getWriter().write(body);
    }
}
