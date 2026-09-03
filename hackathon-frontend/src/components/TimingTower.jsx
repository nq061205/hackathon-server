import { useI18n } from "../i18n/I18nContext";
import { fmtMs, signalKey, teamColor } from "../lib/format";

// Bảng LIVE TIMING kiểu f1dash: ô hạng viền màu đội, cụm vạch sector, thời gian màu.

function currentRun(runs, teamId) {
  const rs = runs.filter((r) => r.teamId === teamId);
  return rs.find((r) => r.status === "running") || rs.slice().sort((a, b) => b.id - a.id)[0] || null;
}

// 3 sector, mỗi sector là cụm 6 vạch, sáng dần theo tiến độ trong sector đó.
function Sectors({ p, finished }) {
  const TICKS = 6;
  return (
    <span className="sct">
      {[0, 1, 2].map((s) => {
        const lo = s / 3, hi = (s + 1) / 3;
        const done = finished || p >= hi;
        const active = !finished && p > lo && p < hi;
        return (
          <span key={s} className="sct-grp">
            {Array.from({ length: TICKS }).map((_, j) => {
              const th = lo + ((j + 1) / TICKS) * (1 / 3);
              const on = (finished || p >= th);
              const cls = on ? (done ? "done" : active ? "cur" : "done") : "";
              return <i key={j} className={cls} />;
            })}
          </span>
        );
      })}
    </span>
  );
}

export default function TimingTower({ data, selRun, onSelect }) {
  const { t } = useI18n();
  const bestBy = new Map((data.board || []).map((b) => [b.teamId, b.bestDurationMs]));

  const rows = data.teams.map((tm) => {
    const run = currentRun(data.runs, tm.id);
    const st = run ? data.statsByRun[run.id] : null;
    const ai = run && data.latestByRun ? (data.latestByRun[run.id] || {}).aiResult : null;
    const progress = ai && typeof ai.progress === "number" ? ai.progress : null;
    return {
      runId: run ? run.id : null, teamId: tm.id, name: tm.teamName, carId: tm.carId,
      status: run ? run.status : "idle",
      progress, best: bestBy.get(tm.id) ?? null, lat: st ? st.avgLatencyMs : null,
    };
  });

  const bestTimes = rows.map((r) => r.best).filter((v) => v != null);
  const fastestOverall = bestTimes.length ? Math.min(...bestTimes) : null;
  const fastestRow = fastestOverall != null ? rows.find((r) => r.best === fastestOverall) : null;

  const rank = (r) => (r.status === "running" ? 0 : r.status === "finished" ? 1 : 2);
  rows.sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (a.status === "running") return (b.progress ?? -1) - (a.progress ?? -1);
    return (a.best ?? Infinity) - (b.best ?? Infinity);
  });

  const runningRows = rows.filter((r) => r.status === "running");
  const runningCount = runningRows.length;
  const leaderProg = runningRows.length ? Math.max(...runningRows.map((r) => r.progress ?? 0)) : 0;

  return (
    <div className="lt">
      <div className="lt-head">
        <span className="lt-title"><i className="lt-bar" />{t("lt.title")}</span>
        <span className="lt-drivers">{t("lt.cars")} <b className="num">{runningCount}/{rows.length}</b></span>
      </div>

      <div className="lt-fastest">
        <span className="lt-fk">◇ {t("lt.fastest")}</span>
        <span className="lt-fv">
          {fastestRow ? <><b>{fastestRow.carId.toUpperCase()}</b> <span className="num t-purple">{fmtMs(fastestOverall)}</span></> : "—"}
        </span>
      </div>

      <div className="lt-legend">
        <span><i className="lg t-purple-bg" />{t("lt.best")}</span>
        <span><i className="lg t-green-bg" />{t("lt.personal")}</span>
        <span><i className="lg t-yellow-bg" />{t("lt.slow")}</span>
        <span className="spacer" />
        <span className="lt-cols">{t("th.pos")} · GAP · SECTORS · {t("th.best")}</span>
      </div>

      <div className="lt-list">
        {rows.map((r, i) => {
          const sig = r.lat != null ? signalKey(r.lat) : "none";
          const timeCls = r.best == null ? "" : (r.best === fastestOverall ? "t-purple" : "t-green");
          const col = teamColor(r.teamId);
          let rightEl;
          if (r.best != null) rightEl = <span className={`num ${timeCls}`}>{fmtMs(r.best)}</span>;
          else if (r.status === "running") {
            const gap = leaderProg - (r.progress ?? 0);
            rightEl = <span className={`num lt-gapv ${gap <= 0.0005 ? "lead" : ""}`}>{gap <= 0.0005 ? t("lt.lead") : "−" + Math.round(gap * 100) + "%"}</span>;
          } else rightEl = <span className="num">—</span>;
          return (
            <button
              key={r.teamId}
              className={`lt-row ${r.runId && selRun === r.runId ? "sel" : ""} ${r.status}`}
              onClick={() => r.runId && onSelect && onSelect(r.runId)}
              style={{ cursor: r.runId ? "pointer" : "default" }}
            >
              <span className="lt-pos" style={{ borderLeftColor: col }}>{r.status === "idle" ? "–" : i + 1}</span>
              <span className="lt-drv">
                <b>{r.carId.toUpperCase()}</b>
                <span className="lt-team">{r.name}</span>
              </span>
              <span className="lt-gap">
                <span className="lt-gk">{t("lt.prog")}</span>
                <span className="num">{r.progress != null ? Math.round(r.progress * 100) + "%" : (r.status === "finished" ? "100%" : "—")}</span>
              </span>
              <Sectors p={r.progress ?? -1} finished={r.status === "finished"} />
              <span className="lt-lap">
                {rightEl}
                <span className={`lt-sig sig-${sig}`} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
