import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import { isDesktop } from "../lib/desktop";
import { ping } from "../lib/api";
import { DEFAULT_API } from "../lib/config";

// Chi co y nghia tren ban desktop (.exe): Electron mo cua so ngay lap tuc
// nhung backend (java -jar) mat vai giay de khoi dong xong. Neu khong cho,
// man hinh dang nhap/dashboard se goi API ngay va an "MAT KET NOI" (do
// nguoi dung phai tu dang xuat/dang nhap lai). BackendGate tu goi ping()
// lien tuc va chi cho render app that su khi backend da tra loi.
// Ban web (npm run dev) khong dung Electron spawn nen bo qua het, hien app
// ngay - dung y het truoc gio.
const POLL_MS = 700;
const SLOW_AFTER_TRIES = 20; // ~14s van chua len -> goi y kiem tra Java/Postgres

export default function BackendGate({ children }) {
  const { t } = useI18n();
  const [ready, setReady] = useState(() => !isDesktop());
  const [tries, setTries] = useState(0);
  const stopped = useRef(false);

  useEffect(() => {
    if (ready) return undefined;
    stopped.current = false;

    async function tick() {
      try {
        await ping(DEFAULT_API);
        if (!stopped.current) setReady(true);
      } catch {
        if (!stopped.current) setTries((n) => n + 1);
      }
    }

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { stopped.current = true; clearInterval(id); };
  }, [ready]);

  if (ready) return children;

  return (
    <div className="backend-gate">
      <div className="backend-gate-box">
        <div className="backend-gate-spinner" />
        <div className="backend-gate-title">{t("gate.starting")}</div>
        <div className="backend-gate-hint">{t("gate.hint")}</div>
        {tries >= SLOW_AFTER_TRIES && <div className="backend-gate-slow">{t("gate.slow")}</div>}
      </div>
    </div>
  );
}
