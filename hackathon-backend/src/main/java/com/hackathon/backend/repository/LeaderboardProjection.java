package com.hackathon.backend.repository;

/**
 * Projection cho bang xep hang - gom TAT CA so lieu cua moi doi trong MOT
 * truy van duy nhat.
 *
 * VI SAO CAN: ban truoc tinh bang xep hang bang vong lap Java, moi doi mot
 * truy van lay danh sach luot, roi moi luot them mot truy van dem log
 * (N+1). Do duoc 73 truy van cho MOT request. Dashboard lai goi
 * /api/leaderboard moi 1,5 giay, nen chi can vai tab mo song song (man chieu
 * + giam khao) la du lam nghen pool 10 ket noi - khong can ai tan cong. Voi
 * nguoi co token viewer thi day la diem khuech dai re nhat: 1 request HTTP
 * doi lay 73 truy van DB.
 */
public interface LeaderboardProjection {
    Integer getTeamId();
    String getTeamName();
    String getCarId();
    Boolean getActive();
    Long getFinishedRuns();
    Long getBestDurationMs();
    Long getTotalLogs();
}
