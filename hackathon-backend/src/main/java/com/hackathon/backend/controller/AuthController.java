package com.hackathon.backend.controller;

import com.hackathon.backend.dto.LoginRequest;
import com.hackathon.backend.dto.LoginResponse;
import com.hackathon.backend.dto.MeResponse;
import com.hackathon.backend.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest req) {
        return authService.login(req);
    }

    @GetMapping("/me")
    public MeResponse me(Authentication auth) {
        String role = auth.getAuthorities().stream().findFirst()
                .map(a -> a.getAuthority().replace("ROLE_", "").toLowerCase())
                .orElse("unknown");
        return new MeResponse(auth.getName(), role);
    }
}
