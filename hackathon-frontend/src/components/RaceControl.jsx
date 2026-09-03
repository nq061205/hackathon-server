import { useI18n } from "../i18n/I18nContext";
import { fmtMs } from "../lib/format";

const hhmmss = (ms) => {
  const d = new Date(ms);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((x) => String(x).padStart(2, "0")).join(":");
};

// Bảng ĐIỀU HÀNH ĐUA kiểu f1dash RACE CONTROL: dòng sự kiện có thời gian + nhãn.
export default function RaceControl({ data }) {
  const { t } = useI18n();
  const teamById = (id) => data.teams.find((x) => x.id === id) || {};
  const car = (id) => (teamById(id).carId || "").toUpperCase();
  const now = Date.now();
  const ev = [];

  data.runs.forEach((r) => {
    if (r.status === "finished" && r.endedAt) {
      const st = data.statsByRun[r.id];
      ev.push({ t: r.endedAt, tag: "FIN", tone: "fin", car: car(r.teamId), msg: `${t("rc.finish")} · ${st ? fmtMs(st.durationMs) : ""}` });
    }
    if (r.status === "unscored" && r.endedAt) {
      ev.push({ t: r.endedAt, tag: "VOID", tone: "void", car: car(r.teamId), msg: t("rc.void") });
    }
    if (r.status === "running") {
      const it = data.latestByRun && data.latestByRun[r.id];
      const ai = it && it.aiResult;
      if (ai && ai.obstacle) {
        const sec = Math.min(3, Math.floor((ai.progress || 0) * 3) + 1);
        ev.push({ t: it.receivedAt || now, tag: "YEL", tone: "yel", car: car(r.teamId), msg: `${t("rc.obstacle")} · SECTOR ${sec}` });
      }
      const st = data.statsByRun[r.id];
      if (st && st.lostEstimate > 0) {
        ev.push({ t: now - 1000, tag: "RC", tone: "rc", car: car(r.teamId), msg: `${t("rc.loss")} (${st.lostEstimate})` });
      }
    }
  });

  ev.sort((a, b) => b.t - a.t);
  const rows = ev.slice(0, 14);

  return (
    <div className="card">
      <div className="sec-h"><i className="rb" /><span className="st">⚑ {t("rc.title")}</span><span className="sm num">{ev.length}</span></div>
      <div className="rc-list">
        {rows.length === 0 && <div className="empty">{t("rc.empty")}</div>}
        {rows.map((e, i) => (
          <div className="rc-row" key={i}>
            <span className="rc-time num">{hhmmss(e.t)}</span>
            <span className={`rc-tag ${e.tone}`}>{e.tag}</span>
            <span className="rc-msg"><b>{e.car}</b> {e.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
