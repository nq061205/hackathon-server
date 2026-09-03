import { useState, useEffect, useCallback } from "react";
import { useI18n } from "../i18n/I18nContext";

function runningRunFor(runs, teamId) {
  return runs.find((r) => r.teamId === teamId && r.status === "running") || null;
}

const MAC_RE = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

export default function AdminConsole({ data, client, refresh, onUnauthorized }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(null); // key thao tac dang chay
  const [toasts, setToasts] = useState([]);
  const [audit, setAudit] = useState([]);
  const [auditSeq, setAuditSeq] = useState(0); // dem de nap lai audit
  const [macDrafts, setMacDrafts] = useState({}); // teamId -> gia tri dang go (chua luu)

  const pushToast = useCallback((msg, type = "ok") => {
    const id = `${Date.now()}-${type}-${msg.length}`;
    setToasts((x) => [...x, { id, msg, type }]);
    setTimeout(() => setToasts((x) => x.filter((tt) => tt.id !== id)), 3200);
  }, []);

  const loadAudit = useCallback(async () => {
    if (!client) return;
    try {
      const r = await client.audit(0, 12);
      setAudit(r.content || []);
    } catch { /* im lang */ }
  }, [client]);

  useEffect(() => { loadAudit(); }, [loadAudit, auditSeq]);

  const act = useCallback(async (key, fn, okMsg) => {
    if (!client) return;
    setBusy(key);
    try {
      await fn();
      pushToast(okMsg, "ok");
      refresh();
      setAuditSeq((n) => n + 1);
    } catch (e) {
      if (e && e.status === 401) { if (onUnauthorized) onUnauthorized(); return; }
      if (e && e.status === 403) { pushToast(t("admin.forbidden"), "err"); return; }
      pushToast(`${t("toast.fail")}${e && e.message ? " · " + e.message : ""}`, "err");
    } finally {
      setBusy(null);
    }
  }, [client, refresh, pushToast, onUnauthorized, t]);

  const saveMac = useCallback((tm, value) => {
    const trimmed = value.trim();
    if (trimmed !== "" && !MAC_RE.test(trimmed)) {
      pushToast(t("admin.macInvalid"), "err");
      return;
    }
    act(`mac${tm.id}`, () => client.teamUpdate(tm.id, { macAddress: trimmed }), t("toast.done"));
  }, [act, client, pushToast, t]);

  const teams = data.teams.slice().sort((a, b) => a.id - b.id);
  const runningRuns = data.runs.filter((r) => r.status === "running");
  const teamName = (id) => (data.teams.find((x) => x.id === id) || {}).teamName || ("#" + id);
  const fmtTime = (ms) => {
    if (ms == null) return "—";
    try { return new Date(Number(ms)).toLocaleTimeString(); } catch { return String(ms); }
  };

  return (
    <div className="admin-grid">
      {/* Cot trai: doi + luot chay */}
      <div>
        <div className="section-h"><span>{t("admin.teams")}</span><span className="rule" /></div>
        <div className="adm-list">
          {teams.length === 0 && <div className="empty">{t("admin.noTeams")}</div>}
          {teams.map((tm) => {
            const run = runningRunFor(data.runs, tm.id);
            return (
              <div key={tm.id} className="adm-row">
                <div className="who">
                  {tm.teamName}
                  <span className={`tag ${tm.active ? "active" : "revoked"}`}>
                    {tm.active ? t("admin.active") : t("admin.revoked")}
                  </span>
                  {run && <span className="tag running">{t("admin.running")} #{run.heatNo}</span>}
                  <small className="num">{tm.carId} · {tm.username}</small>
                  <div className="mac-edit">
                    <span className="mac-label">{t("admin.mac")}</span>
                    <input
                      type="text"
                      className="mac-input"
                      placeholder={t("admin.macPlaceholder")}
                      value={macDrafts[tm.id] ?? tm.macAddress ?? ""}
                      onChange={(e) => setMacDrafts((d) => ({ ...d, [tm.id]: e.target.value }))}
                      disabled={busy != null}
                    />
                    <button className="btn sm" disabled={busy != null}
                      onClick={() => saveMac(tm, macDrafts[tm.id] ?? tm.macAddress ?? "")}>
                      {t("admin.macSave")}
                    </button>
                  </div>
                </div>
                <div className="adm-actions">
                  {tm.active ? (
                    <button className="btn sm danger-btn" disabled={busy != null}
                      onClick={() => { if (window.confirm(t("admin.confirmRevoke"))) act(`rev${tm.id}`, () => client.teamRevoke(tm.id), t("toast.done")); }}>
                      {t("admin.revoke")}
                    </button>
                  ) : (
                    <button className="btn sm go-btn" disabled={busy != null}
                      onClick={() => act(`res${tm.id}`, () => client.teamRestore(tm.id), t("toast.done"))}>
                      {t("admin.restore")}
                    </button>
                  )}
                  <button className="btn sm" disabled={busy != null || !!run}
                    onClick={() => act(`open${tm.id}`, () => client.runOpen(tm.id), t("toast.done"))}>
                    {t("admin.openRun")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="adm-sub">{t("admin.runs")}</div>
        <div className="adm-list">
          {runningRuns.length === 0 && <div className="empty">{t("admin.noRunning")}</div>}
          {runningRuns.map((r) => (
            <div key={r.id} className="adm-row">
              <div className="who">
                {teamName(r.teamId)}
                <span className="tag running">{t("admin.running")} #{r.heatNo}</span>
                <small className="num">run #{r.id} · {fmtTime(r.startedAt)}</small>
              </div>
              <div className="adm-actions">
                <button className="btn sm go-btn" disabled={busy != null}
                  onClick={() => act(`fin${r.id}`, () => client.runFinish(r.id), t("toast.done"))}>
                  {t("admin.finish")}
                </button>
                <button className="btn sm cau-btn" disabled={busy != null}
                  onClick={() => { if (window.confirm(t("admin.confirmVoid"))) act(`void${r.id}`, () => client.runVoid(r.id), t("toast.done")); }}>
                  {t("admin.void")}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cot phai: nhat ky thao tac */}
      <div className="panel">
        <div className="head">
          <div className="title">{t("admin.audit")}</div>
          <div className="spacer" />
          <button className="btn sm" onClick={() => setAuditSeq((n) => n + 1)}>{t("admin.refresh")}</button>
        </div>
        <div className="audit-wrap">
          {audit.length === 0 ? (
            <div className="empty">{t("audit.empty")}</div>
          ) : (
            <table className="audit">
              <thead>
                <tr>
                  <th>{t("audit.time")}</th>
                  <th>{t("audit.user")}</th>
                  <th>{t("audit.action")}</th>
                  <th>{t("audit.detail")}</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td className="num">{fmtTime(a.createdAt)}</td>
                    <td>{a.adminUser}</td>
                    <td><span className="act">{a.action}</span> {a.tableName}#{a.recordId}</td>
                    <td>{a.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Toasts */}
      <div className="toast-wrap">
        {toasts.map((tt) => (
          <div key={tt.id} className={`toast ${tt.type}`}>{tt.msg}</div>
        ))}
      </div>
    </div>
  );
}
