import { useI18n } from "../i18n/I18nContext";
import { fmtMs } from "../lib/format";

// Dải điều kiện đua kiểu f1dash: các ô chỉ số + thanh tiến độ đua + nút ẩn sidebar.
export default function RaceConditions({ data, sideHidden, onToggleSide }) {
  const { t } = useI18n();
  const running = data.runs.filter((r) => r.status === "running");
  const board = data.board || [];

  const bestTimes = board.map((b) => b.bestDurationMs).filter((v) => v != null);
  const fastest = bestTimes.length ? Math.min(...bestTimes) : null;

  const stats = running.map((r) => data.statsByRun[r.id]).filter(Boolean);
  const lats = stats.map((s) => s.avgLatencyMs).filter((v) => v != null);
  const avgLat = lats.length ? lats.reduce((a, b) => a + b, 0) / lats.length : null;
  const lost = Object.values(data.statsByRun || {}).reduce((a, s) => a + (s.lostEstimate || 0), 0);
  const goodSig = lats.filter((v) => v <= 30).length;

  const progs = running.map((r) => {
    const ai = data.latestByRun && data.latestByRun[r.id] && data.latestByRun[r.id].aiResult;
    return ai && typeof ai.progress === "number" ? ai.progress : 0;
  });
  const avgProg = progs.length ? progs.reduce((a, b) => a + b, 0) / progs.length : 0;

  const latWord = avgLat == null ? "—" : avgLat <= 30 ? t("q.instant") : avgLat <= 80 ? t("q.slight") : t("q.slow");
  const linkWord = lost > 0 ? t("q.drop") : t("q.stable");

  const cell = (k, v, cls = "", tip = "", sub = null) => (
    <div className="cond-cell" title={tip}>
      <span className="cond-k">{k}</span>
      <span className={`cond-v ${cls}`}>{v}{sub != null && <i className="cond-u">{sub}</i>}</span>
    </div>
  );

  return (
    <div className="conds">
      <div className="cond-tiles">
        {cell(t("ses.running"), <>{running.length}<i className="cond-u">/{data.teams.length}</i></>, "go", t("tip.running"))}
        {cell(t("cond.good"), <>{goodSig}<i className="cond-u">/{running.length || 0}</i></>, "", t("tip.good"))}
        {cell(t("ses.fastest"), fastest != null ? fmtMs(fastest) : "—", "t-purple num", t("tip.fastest"))}
        {cell(t("cond.sigspeed"), latWord, avgLat != null && avgLat > 80 ? "warn" : "", t("tip.speedsig"), avgLat != null ? fmtMs(avgLat) : null)}
        {cell(t("cond.link"), linkWord, lost > 0 ? "warn" : "go", t("tip.link"), lost > 0 ? "(" + lost + ")" : null)}
      </div>
      <div className="cond-prog">
        <div className="cond-prog-top">
          <span className="cond-k">{t("cond.raceprog")}</span>
          <span className="num cond-pv">{Math.round(avgProg * 100)}%</span>
        </div>
        <div className="cond-bar"><i style={{ width: Math.round(avgProg * 100) + "%" }} /></div>
      </div>
      <button className="cond-hide" onClick={onToggleSide}>
        {sideHidden ? "▸ " + t("cond.showbar") : "◂ " + t("cond.hidebar")}
      </button>
    </div>
  );
}
