package com.hackathon.backend.controller;

import com.hackathon.backend.dto.*;
import com.hackathon.backend.service.RunService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/runs")
public class RunController {

    private final RunService runService;

    public RunController(RunService runService) {
        this.runService = runService;
    }

    @GetMapping
    public List<RunResponse> list(@RequestParam(required = false) String status) {
        return runService.list(status);
    }

    @GetMapping("/{id}")
    public RunResponse get(@PathVariable Integer id) {
        return runService.get(id);
    }

    /** Mo mot luot chay moi cho mot doi. */
    @PostMapping
    public RunResponse open(@Valid @RequestBody RunCreateRequest req) {
        return runService.open(req);
    }

    /** Ket thuc luot (status=finished). */
    @PostMapping("/{id}/finish")
    public RunResponse finish(@PathVariable Integer id, @RequestBody(required = false) RunFinishRequest req) {
        return runService.finish(id, req);
    }

    /** Huy luot (status=void), giu nguyen log. */
    @PostMapping("/{id}/void")
    public RunResponse voidRun(@PathVariable Integer id, @RequestBody(required = false) RunVoidRequest req) {
        return runService.voidRun(id, req);
    }
}
