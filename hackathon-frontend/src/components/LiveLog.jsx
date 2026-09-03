import { useRef } from "react";
import { useI18n } from "../i18n/I18nContext";
import { Signal } from "../lib/sprites";
import { fmtMs, fmtInt, latClass } from "../lib/format";

export default function LiveLog({ data, selRun }) {
  const { t } = useI18n();
  const seenRef = useRef({}); // runId -> Set(seq) de danh dau dong moi (flash)

  const run = data.runs.find((r) => r.id === selRun);
  const team = run ? data.teams.find((x) => x.id === run.teamId) : null;
  const st = selRun ? data.statsByRun[selRun] : null;
  const rows = (selRun && data.logsByRun[selRun]) || [];

  const seen = seenRef.current[selRun] || new Set();
  const newFlags = rows.map((r) => !seen.has(r.sequenceNo));
  if (selRun) seenRef.current[selRun] = new Set(rows.map((r) => r.sequenceNo));

  const stats = st
    ? [
        [t("m.packets"), fmtInt(st.logCount), "var(--run)", t("tip.packets")],
        [t("m.latency"), fmtMs(st.avgLatencyMs), latClass(st.avgLatencyMs) === "hi" ? "var(--danger)" : "var(--go)", t("tip.latency")],
        [t("m.loss"), st.lostEstimate || 0, st.lostEstimate > 0 ? "var(--danger)" : "var(--go)", t("tip.loss")],
        [t("m.seq"), st.maxSeq != null ? "0–" + st.maxSeq : "—", "", t("tip.seq")],
        [t("m.dur"), fmtMs(st.durationMs), "var(--caution)", t("tip.dur")],
        [t("m.max"), fmtMs(st.maxLatencyMs), latClass(st.maxLatencyMs) === "hi" ? "var(--danger)" : "var(--caution)", t("tip.max")],
      ]
    : [];

  return (
    <div className="panel">
      <div className="head">
        <Signal u={3} />
        <div className="title">
          <span>{t("log.title")}</span>
          <small>{team ? `— ${team.teamName} · ${team.carId}` : ` ${t("log.pickCar")}`}</small>
        </div>
      </div>

      {st && (
        <div className="statrow">
          {stats.map(([k, v, c, tip], i) => (
            <div key={i} className="stat" title={tip}>
              <div className="k">{k}</div>
              <div className="v" style={c ? { color: c } : undefined}>{v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="log" role="log" aria-live="polite">
        {!selRun && <div className="empty">{t("log.pickHint")}</div>}
        {selRun && rows.length === 0 && <div className="empty">···</div>}
        {rows.map((it, i) => {
          const ai = it.aiResult || {};
          const lat = it.latencyMs != null ? Math.round(it.latencyMs) : null;
          return (
            <div key={it.sequenceNo} className={`logrow ${newFlags[i] ? "isnew" : ""}`}>
              <span className="seq num">#{it.sequenceNo}</span>
              <span className="body">
                <b>{ai.speed_kmh ?? "?"}</b>{t("u.speed")} · {t("u.steer")} {ai.steering_deg ?? "?"}° · {t("u.offset")} {ai.lane_offset_cm ?? "?"}cm{" "}
                {ai.obstacle && <span className="obstacle">{t("obstacle")}</span>}
              </span>
              <span className={`lat num ${latClass(lat)}`}>{lat != null ? lat + "ms" : "—"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
