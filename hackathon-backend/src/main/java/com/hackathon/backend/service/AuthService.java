package com.hackathon.backend.service;

import com.hackathon.backend.config.JwtService;
import com.hackathon.backend.dto.LoginRequest;
import com.hackathon.backend.dto.LoginResponse;
import com.hackathon.backend.entity.AppUser;
import com.hackathon.backend.exception.ApiException;
import com.hackathon.backend.repository.AppUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(AppUserRepository appUserRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest req) {
        AppUser user = appUserRepository.findByUsername(req.username())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Sai tai khoan hoac mat khau"));

        if (!user.isActive()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Tai khoan da bi khoa");
        }
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Sai tai khoan hoac mat khau");
        }

        String token = jwtService.generate(user.getUsername(), user.getRole());
        return new LoginResponse(token, user.getUsername(), user.getFullName(),
                user.getRole(), jwtService.getExpirationMinutes());
    }
}
