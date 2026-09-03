package com.hackathon.backend.repository;

import com.hackathon.backend.entity.Team;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TeamRepository extends JpaRepository<Team, Integer> {
    Optional<Team> findByUsername(String username);
    List<Team> findAllByOrderByIdAsc();
}
