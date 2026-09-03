import { useI18n } from "../i18n/I18nContext";
import { fmtMs, teamColor } from "../lib/format";

// Dải chỉ số phiên đua (kiểu header thông tin session của F1 TV):
// số xe đang chạy · đội dẫn đầu · thời gian nhanh nhất · độ trễ TB.
export default function SessionStats({ data, strip = false }) {
  const { t } = useI18n();
  const board = data.board || [];
  const running = data.runs.filter((r) => r.status === "running");

  const leader = board.find((b) => b.bestDurationMs != null) || board[0] || null;
  const bestTimes = board.map((b) => b.bestDurationMs).filter((v) => v != null);
  const fastest = bestTimes.length ? Math.min(...bestTimes) : null;

  const lats = running
    .map((r) => data.statsByRun[r.id])
    .filter((s) => s && s.avgLatencyMs != null)
    .map((s) => s.avgLatencyMs);
  const avgLat = lats.length ? lats.reduce((a, b) => a + b, 0) / lats.length : null;

  return (
    <div className={strip ? "ses ses-strip" : "ses"}>
      <div className="ses-cell">
        <span className="ses-k">{t("ses.running")}</span>
        <span className="ses-v run">{running.length}<i>/{data.teams.length}</i></span>
      </div>
      <div className="ses-cell">
        <span className="ses-k">{t("ses.leader")}</span>
        <span className="ses-v lead">
          {leader ? <><i className="ses-dot" style={{ background: teamColor(leader.teamId) }} />{leader.teamName}</> : "—"}
        </span>
      </div>
      <div className="ses-cell">
        <span className="ses-k">{t("ses.fastest")}</span>
        <span className="ses-v t-purple num">{fastest != null ? fmtMs(fastest) : "—"}</span>
      </div>
      <div className="ses-cell">
        <span className="ses-k">{t("ses.avglat")}</span>
        <span className="ses-v num">{avgLat != null ? fmtMs(avgLat) : "—"}</span>
      </div>
    </div>
  );
}
