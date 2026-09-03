import { useEffect, useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import { Flag, User } from "../lib/sprites";

// Icon nét mảnh kiểu f1dash cho từng kênh.
function Icon({ name }) {
  const p = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "overview": return <svg {...p}><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></svg>;
    case "timing": return <svg {...p}><circle cx="8" cy="9" r="5" /><path d="M8 9V6M6 1.5h4" /></svg>;
    case "network": return <svg {...p}><path d="M2 13h2v-3H2zM7 13h2V7H7zM12 13h2V4h-2z" /></svg>;
    case "logs": return <svg {...p}><rect x="2.5" y="1.5" width="11" height="13" rx="1.2" /><path d="M5 5h6M5 8h6M5 11h3.5" /></svg>;
    case "screen": return <svg {...p}><rect x="1.5" y="2.5" width="13" height="8.5" rx="1" /><path d="M6 14h4M8 11v3" /></svg>;
    case "admin": return <svg {...p}><path d="M2 4h12M2 8h12M2 12h12" /><circle cx="6" cy="4" r="1.4" fill="currentColor" stroke="none" /><circle cx="11" cy="8" r="1.4" fill="currentColor" stroke="none" /><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" /></svg>;
    default: return null;
  }
}

function Clock() {
  const [ts, setTs] = useState("--:--:--");
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setTs([d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()].map((x) => String(x).padStart(2, "0")).join(":"));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <b className="num">{ts}</b>;
}

export default function Sidebar({ session, online, tabs, active, onSelect, onLogout, data }) {
  const { t, lang, toggle } = useI18n();
  const isDemo = session.mode === "demo";
  const dotClass = isDemo ? "demo" : online ? "live" : "off";
  const roleLabel = session.role === "admin" ? t("role.admin") : t("role.viewer");
  const userLabel = isDemo ? t("session.demo") : `${session.user} · ${roleLabel}`;

  const packets = Object.values(data.statsByRun || {}).reduce((a, s) => a + (s.logCount || 0), 0);

  return (
    <aside className="side">
      <div className="side-brand">
        <span className="brand-badge"><Flag u={4} /></span>
        <div>
          <strong>{t("title")}<em>.</em></strong>
          <span>{t("side.console")}</span>
        </div>
      </div>

      <div className="side-clock">
        <span>UTC <Clock /></span>
        <span>{t("side.pkt")} <b className="num brand-num">{packets.toLocaleString()}</b></span>
      </div>

      <div className="side-sec">{t("side.channels")}</div>
      <nav className="side-nav">
        {tabs.map((k) => (
          <button key={k} className={`side-item ${active === k ? "on" : ""}`} onClick={() => onSelect(k)}>
            <Icon name={k} />
            <span>{t("tab." + k)}</span>
            <em>{t("navtag." + k)}</em>
          </button>
        ))}
      </nav>

      <div className="side-spacer" />

      <div className="side-sec">{t("side.session")}</div>
      <div className="side-user">
        <span className="pill user"><User u={3} /><span className="uname">{userLabel}</span></span>
        <span className="pill"><span className={`dot ${dotClass}`} /><span>{isDemo ? t("conn.demo") : online ? t("conn.live") : t("conn.off")}</span></span>
      </div>
      <div className="side-actions">
        <button className="btn ghost sm" onClick={toggle} title="VI / EN">{lang.toUpperCase()}</button>
        <button className="btn danger-btn sm side-logout" onClick={onLogout}>{t("btn.logout")}</button>
      </div>
      <div className="side-foot">{t("foot")} · v1.0</div>
    </aside>
  );
}
