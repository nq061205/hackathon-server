import { useI18n } from "../i18n/I18nContext";

// Bảng SỰ CỐ kiểu f1dash INCIDENTS: bộ đếm + danh sách cảnh báo (thay cho phạt/điều tra).
export default function Incidents({ data }) {
  const { t } = useI18n();
  const teamById = (id) => data.teams.find((x) => x.id === id) || {};

  let obstacles = 0, lossN = 0, weakN = 0, voidN = 0;
  const list = [];

  data.runs.forEach((r) => {
    if (r.status === "unscored") voidN++;
    if (r.status !== "running") return;
    const tm = teamById(r.teamId);
    const st = data.statsByRun[r.id];
    const ai = data.latestByRun && data.latestByRun[r.id] && data.latestByRun[r.id].aiResult;
    const warns = [];
    if (ai && ai.obstacle) { obstacles++; warns.push({ k: "obs", tone: "yel" }); }
    if (st && st.lostEstimate > 0) { lossN++; warns.push({ k: "loss", tone: "rc" }); }
    if (st && st.avgLatencyMs != null && st.avgLatencyMs > 80) { weakN++; warns.push({ k: "weak", tone: "void" }); }
    if (warns.length) list.push({ car: (tm.carId || "").toUpperCase(), name: tm.teamName, warns });
  });

  const counter = (n, k, tone) => (
    <div className="inc-c">
      <span className={`inc-n ${tone}`}>{n}</span>
      <span className="inc-k">{k}</span>
    </div>
  );

  return (
    <div className="card">
      <div className="sec-h"><i className="rb" /><span className="st">⚠ {t("inc.title")}</span></div>
      <div className="inc-counts">
        {counter(obstacles, t("inc.obs"), "yel")}
        {counter(lossN, t("inc.loss"), "rc")}
        {counter(weakN, t("inc.weak"), "void")}
        {counter(voidN, t("inc.void"), "muted")}
      </div>
      <div className="inc-list">
        {list.length === 0 && <div className="empty">{t("inc.clear")}</div>}
        {list.map((r, i) => (
          <div className="inc-row" key={i}>
            <span className="inc-car num">{r.car}</span>
            <span className="inc-name">{r.name}</span>
            <span className="inc-tags">
              {r.warns.map((w, j) => <span key={j} className={`rc-tag ${w.tone}`}>{t("inc." + w.k)}</span>)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
