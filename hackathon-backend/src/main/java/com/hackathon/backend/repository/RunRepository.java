package com.hackathon.backend.repository;

import com.hackathon.backend.entity.Run;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RunRepository extends JpaRepository<Run, Integer> {
    List<Run> findAllByOrderByStartedAtDesc();
    List<Run> findByTeamIdOrderByHeatNoAsc(Integer teamId);
    List<Run> findByStatusOrderByStartedAtDesc(String status);

    // Dung cho GET /api/teams/{id}/car-status: doi thuong chi co toi da 1
    // luot dang "running" tai 1 thoi diem - lay ban ghi moi nhat cho chac
    // (phong truong hop du lieu cu/loi con sot >1 dong running).
    Optional<Run> findFirstByTeamIdAndStatusOrderByIdDesc(Integer teamId, String status);

    // heat_no tiep theo cho mot doi (max hien tai + 1; null -> 1)
    default int nextHeatNo(Integer teamId) {
        return findByTeamIdOrderByHeatNoAsc(teamId).stream()
                .map(Run::getHeatNo)
                .max(Integer::compareTo)
                .map(h -> h + 1)
                .orElse(1);
    }
}
