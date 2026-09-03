import { useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import { fmtMs, signalKey, connKey, teamColor } from "../lib/format";

function currentRun(runs, teamId) {
  const rs = runs.filter((r) => r.teamId === teamId);
  return rs.find((r) => r.status === "running") || rs.slice().sort((a, b) => b.id - a.id)[0] || null;
}

const statusLabel = (s, t) =>
  s === "running" ? t("b.run") : s === "finished" ? t("b.fin") : s === "unscored" || s === "void" ? t("b.void") : t("b.idle");
const statusCls = (s) =>
  s === "running" ? "run" : s === "finished" ? "fin" : s === "unscored" || s === "void" ? "void" : "idle";

export default function LiveTiming({ data, selRun, onSelect }) {
  const { t } = useI18n();
  const [sort, setSort] = useState({ key: "progress", dir: -1 });

  const bestBy = new Map((data.board || []).map((b) => [b.teamId, b.bestDurationMs]));
  const rows = data.teams.map((tm) => {
    const run = currentRun(data.runs, tm.id);
    const st = run ? data.statsByRun[run.id] : null;
    const ai = run && data.latestByRun ? (data.latestByRun[run.id] || {}).aiResult : null;
    const progress = ai && typeof ai.progress === "number" ? ai.progress : null;
    return {
      runId: run ? run.id : null, teamId: tm.id, name: tm.teamName, carId: tm.carId, active: tm.active,
      status: run ? run.status : "idle", heat: run ? run.heatNo : null,
      progress, best: bestBy.get(tm.id) ?? null,
      cur: st && run && run.status === "running" ? st.durationMs : null,
      lat: st ? st.avgLatencyMs : null, loss: st ? st.lostEstimate || 0 : 0,
    };
  });

  // Thoi gian nhanh nhat toan cuoc -> to mau tim (kieu F1: fastest overall = purple).
  const bestTimes = rows.map((r) => r.best).filter((v) => v != null);
  const fastestOverall = bestTimes.length ? Math.min(...bestTimes) : null;

  const pick = (r) => ({ progress: r.progress ?? -1, best: r.best ?? Infinity, latency: r.lat ?? Infinity }[sort.key]);
  rows.sort((a, b) => {
    const ra = a.status === "running" ? 0 : 1, rb = b.status === "running" ? 0 : 1;
    if (ra !== rb) return ra - rb;
    const va = pick(a), vb = pick(b);
    return va < vb ? sort.dir : va > vb ? -sort.dir : 0;
  });

  const head = (key, label, defDir = -1) => (
    <th className={`sortable ${sort.key === key ? "on" : ""}`}
        onClick={() => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: defDir }))}>
      {label}{sort.key === key ? (sort.dir < 0 ? " ▾" : " ▴") : ""}
    </th>
  );

  return (
    <div className="panel">
      <div className="head"><div className="title">Live Timing<small>{t("timing.hint")}</small></div></div>
      <div className="timing-wrap">
        <table className="timing">
          <thead>
            <tr>
              <th></th>
              <th>{t("th.pos")}</th>
              <th style={{ textAlign: "left" }}>{t("th.team")}</th>
              <th>{t("th.status")}</th>
              {head("progress", t("th.progress"))}
              {head("best", t("th.best"), 1)}
              <th>{t("th.cur")}</th>
              <th>{t("th.signal")}</th>
              {head("latency", t("th.latency"), 1)}
              <th>{t("th.link")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const sig = signalKey(r.lat), conn = connKey(r.loss);
              const bestCls = r.best == null ? "" : (r.best === fastestOverall ? "t-purple" : "t-green");
              return (
                <tr key={r.teamId} className={r.runId && selRun === r.runId ? "sel" : ""}
                    onClick={() => r.runId && onSelect && onSelect(r.runId)} style={{ cursor: r.runId ? "pointer" : "default" }}>
                  <td className="tcol"><i style={{ background: teamColor(r.teamId) }} /></td>
                  <td className="pos num">{i + 1}</td>
                  <td className="team"><b>{r.name}</b><span className="num">{r.carId}{r.heat ? " · #" + r.heat : ""}</span></td>
                  <td><span className={`badge ${statusCls(r.status)}`}>{statusLabel(r.status, t)}</span></td>
                  <td>
                    {r.progress != null ? (
                      <span className="cell-prog">
                        <span className="tt-sectors">
                          {[0, 1, 2].map((s) => {
                            const lo = s / 3, hi = (s + 1) / 3;
                            const cls = r.progress >= hi ? "done" : r.progress > lo ? "cur" : "";
                            return <i key={s} className={cls} />;
                          })}
                        </span>
                        <span className="num">{Math.round(r.progress * 100)}%</span>
                      </span>
                    ) : "—"}
                  </td>
                  <td className={`num ${bestCls}`}>{r.best != null ? fmtMs(r.best) : "—"}</td>
                  <td className="num">{r.cur != null ? fmtMs(r.cur) : "—"}</td>
                  <td>{r.lat != null ? <span className={`chip sig-${sig}`}>{t("sig." + sig)}</span> : "—"}</td>
                  <td className="num">{r.lat != null ? fmtMs(r.lat) : "—"}</td>
                  <td><span className={`chip conn-${conn}`}>{t("conn." + conn)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
