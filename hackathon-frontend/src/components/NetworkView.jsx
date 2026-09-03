import { useI18n } from "../i18n/I18nContext";
import { fmtMs, signalKey, connKey } from "../lib/format";

function currentRun(runs, teamId) {
  const rs = runs.filter((r) => r.teamId === teamId);
  return rs.find((r) => r.status === "running") || rs.slice().sort((a, b) => b.id - a.id)[0] || null;
}

export default function NetworkView({ data }) {
  const { t } = useI18n();

  const rows = data.teams.map((tm) => {
    const run = currentRun(data.runs, tm.id);
    const st = run ? data.statsByRun[run.id] : null;
    const running = run && run.status === "running";
    const lat = st ? st.avgLatencyMs : null;
    const minLat = st ? st.minLatencyMs : null;
    const loss = st ? st.lostEstimate || 0 : 0;
    const warns = [];
    if (lat != null && lat > 80) warns.push(t("net.w.slow"));
    if (loss > 0) warns.push(t("net.w.loss"));
    if (minLat != null && minLat < 0) warns.push(t("net.w.ntp"));
    return { teamId: tm.id, name: tm.teamName, carId: tm.carId, active: tm.active, running, lat, loss, warns };
  });
  // xe có vấn đề lên trước
  rows.sort((a, b) => (b.warns.length - a.warns.length) || ((b.lat ?? -1) - (a.lat ?? -1)));

  return (
    <div className="panel">
      <div className="head"><div className="title">{t("net.title")}<small>{t("net.hint")}</small></div></div>
      <div className="timing-wrap">
        <table className="timing net">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>{t("th.team")}</th>
              <th>{t("net.auth")}</th>
              <th>{t("net.link")}</th>
              <th>{t("net.latency")}</th>
              <th>{t("net.loss")}</th>
              <th style={{ textAlign: "left" }}>{t("net.warn")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const sig = signalKey(r.lat), conn = connKey(r.loss);
              return (
                <tr key={r.teamId}>
                  <td className="team"><b>{r.name}</b><span className="num">{r.carId}</span></td>
                  <td><span className={`tag ${r.active ? "active" : "revoked"}`}>{r.active ? t("net.authed") : t("net.revoked")}</span></td>
                  <td><span className={`tag ${r.running ? "running" : ""}`}>{r.running ? t("net.tx") : t("net.idle")}</span></td>
                  <td className="num">{r.lat != null ? <span className={`chip sig-${sig}`}>{fmtMs(r.lat)}</span> : "—"}</td>
                  <td className="num" style={{ color: r.loss > 0 ? "var(--danger)" : "var(--muted)" }}>{r.loss}</td>
                  <td style={{ textAlign: "left" }}>
                    {r.warns.length === 0
                      ? <span className={`chip conn-${conn}`}>{t("net.w.none")}</span>
                      : r.warns.map((w, i) => <span key={i} className="warnchip">⚠ {w}</span>)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
