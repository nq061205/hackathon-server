import { useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import { Flag, Signal, Trophy, CarRun } from "../lib/sprites";

const DEFAULT_API = import.meta.env.VITE_DEFAULT_API ?? "http://localhost:8080";

/**
 * Trang landing + đăng nhập. Hero bên trái giới thiệu, thẻ đăng nhập bên phải.
 * Địa chỉ API lấy từ .env (VITE_DEFAULT_API) — không nhập tay.
 */
export default function LoginScreen({ onLogin }) {
  const { t, lang, toggle } = useI18n();
  const api = DEFAULT_API;
  const [user, setUser] = useState("viewer");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [info, setInfo] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setMsg(""); setInfo(false);
    if (location.protocol === "https:" && /^http:\/\/(localhost|127\.|192\.168\.|10\.|172\.)/.test(api)) {
      setMsg(t("note.blocked")); setInfo(true); return;
    }
    setBusy(true);
    try {
      await onLogin(api, user, pass);
    } catch {
      setMsg(t("err.login"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="landing">
      <header className="site-header">
        <div className="brand">
          <span className="brand-badge"><Flag u={5} /></span>
          <div><strong>Hackathon</strong><span>{t("brand.tag")}</span></div>
        </div>
        <button className="btn ghost" onClick={toggle} title="VI / EN">{lang.toUpperCase()}</button>
      </header>

      <main className="hero">
        <div className="hero-copy">
          <span className="eyebrow">{t("hero.eyebrow")}</span>
          <h1 className="hero-title">{t("hero.title")} <span className="accent">{t("hero.titleAccent")}</span></h1>
          <p className="hero-sub">{t("hero.sub")}</p>
          <ul className="hero-feats">
            <li><span className="ico"><Signal u={3} /></span>{t("hero.f1")}</li>
            <li><span className="ico"><Trophy u={3} /></span>{t("hero.f2")}</li>
            <li><span className="ico"><CarRun u={3} /></span>{t("hero.f3")}</li>
          </ul>
        </div>

        <div className="login-card">
          <h2 className="login-title">{t("login.welcome")}</h2>
          <p className="login-sub">{t("login.sub")}</p>
          <form onSubmit={submit} autoComplete="on">
            <div className="field">
              <label>{t("conn.user")}</label>
              <input value={user} onChange={(e) => setUser(e.target.value)} spellCheck={false} autoComplete="username" />
            </div>
            <div className="field">
              <label>{t("conn.pass")}</label>
              <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" />
            </div>
            <div className={`msg ${info ? "info" : ""}`}>{msg}</div>
            <button className="btn on login-go" type="submit" disabled={busy}>
              {busy ? t("login.signingin") : t("login.signin")}
            </button>
          </form>
        </div>
      </main>

      <footer className="landing-foot"><b>WPA2-Enterprise / RADIUS</b> · Hackathon</footer>
    </div>
  );
}
