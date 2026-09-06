package com.hackathon.backend.repository;

import com.hackathon.backend.entity.Team;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface TeamRepository extends JpaRepository<Team, Integer> {
    Optional<Team> findByUsername(String username);
    List<Team> findAllByOrderByIdAsc();

    /**
     * Toan bo bang xep hang trong MOT truy van (thay cho vong lap N+1 cu).
     *
     * - LEFT JOIN runs  : doi chua chay luot nao van co mat trong bang.
     * - LEFT JOIN LATERAL (dem log cua tung run): giu dung cach ban cu dung
     *   chi muc khoa chinh (run_id, sequence_no) - dem theo TUNG run - nhung
     *   gom het vao MOT vong goi. Da do: 41 ms (N+1) -> 19 ms.
     *   KHONG dung "(SELECT run_id, COUNT(*) FROM logs GROUP BY run_id)": cach
     *   do phai quet toan bo bang logs moi lan goi, do duoc 116 ms - cham hon
     *   ca ban N+1 cu.
     * - FILTER (...) : chi tinh luot 'finished' co du hai moc thoi gian,
     *   dung y het dieu kien cua ban Java cu.
     * - trunc(...)::bigint : khop cach Duration.toMillis() cat phan le.
     */
    @Query(value = """
            SELECT t.id          AS "teamId",
                   t.team_name   AS "teamName",
                   t.car_id      AS "carId",
                   t.is_active   AS "active",
                   COUNT(r.id) FILTER (
                       WHERE r.status = 'finished'
                         AND r.ended_at IS NOT NULL
                         AND r.started_at IS NOT NULL) AS "finishedRuns",
                   MIN(trunc(EXTRACT(EPOCH FROM (r.ended_at - r.started_at)) * 1000)::bigint) FILTER (
                       WHERE r.status = 'finished'
                         AND r.ended_at IS NOT NULL
                         AND r.started_at IS NOT NULL) AS "bestDurationMs",
                   COALESCE(SUM(lc.cnt), 0) AS "totalLogs"
            FROM teams t
            LEFT JOIN runs r ON r.team_id = t.id
            LEFT JOIN LATERAL (
                       SELECT COUNT(*) AS cnt FROM logs l WHERE l.run_id = r.id) lc ON true
            GROUP BY t.id, t.team_name, t.car_id, t.is_active
            ORDER BY t.id
            """, nativeQuery = true)
    List<LeaderboardProjection> leaderboardRows();
}
