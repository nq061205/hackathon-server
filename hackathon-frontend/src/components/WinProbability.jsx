import { useI18n } from "../i18n/I18nContext";
import { teamColor } from "../lib/format";

// Xác suất dẫn đầu (heuristic): dựa trên tiến độ hiện tại của các xe đang chạy.
export default function WinProbability({ data }) {
  const { t } = useI18n();
  const teamById = (id) => data.teams.find((x) => x.id === id) || {};
  const running = data.runs.filter((r) => r.status === "running");

  let rows = running.map((r) => {
    const ai = data.latestByRun && data.latestByRun[r.id] && data.latestByRun[r.id].aiResult;
    const p = ai && typeof ai.progress === "number" ? ai.progress : 0.001;
    return { teamId: r.teamId, carId: teamById(r.teamId).carId || "", w: Math.pow(Math.max(p, 0.001), 6) };
  });

  // fallback: nếu không có xe chạy, xét xe đã xong theo thời gian.
  if (rows.length === 0) {
    const fin = (data.board || []).filter((b) => b.bestDurationMs != null);
    const min = fin.length ? Math.min(...fin.map((b) => b.bestDurationMs)) : 1;
    rows = fin.map((b) => ({ teamId: b.teamId, carId: b.carId || "", w: Math.pow(min / b.bestDurationMs, 6) }));
  }

  const sum = rows.reduce((a, r) => a + r.w, 0) || 1;
  rows = rows.map((r) => ({ ...r, pct: (r.w / sum) * 100 })).sort((a, b) => b.pct - a.pct).slice(0, 8);

  return (
    <div className="card">
      <div className="sec-h">
        <i className="rb" /><span className="st">🏆 {t("wp.title")}</span>
        <span className="sm">{t("wp.sub")}</span>
      </div>
      <div className="card-b wp">
        {rows.length === 0 && <div className="empty">{t("empty.board")}</div>}
        {rows.map((r, i) => (
          <div className="wp-row" key={r.teamId}>
            <span className="wp-pos">P{i + 1}</span>
            <span className="wp-name num" style={{ color: teamColor(r.teamId) }} title={r.carId || ""}>{(r.carId || "").toUpperCase()}</span>
            <span className="wp-bar"><i style={{ width: Math.max(1, r.pct) + "%", background: teamColor(r.teamId) }} /></span>
            <span className="wp-pct num">{r.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
