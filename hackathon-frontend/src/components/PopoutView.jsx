import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useRaceData } from "../hooks/useRaceData";
import { useI18n } from "../i18n/I18nContext";
import { findSource } from "../lib/sources";
import { isDesktop, mergeBack } from "../lib/desktop";

// Nội dung của một cửa sổ đã "tách" ra riêng (xem lib/desktop.js#openPopout).
// Cùng ứng dụng Electron với cửa sổ chính nên đọc lại được phiên đăng nhập
// trong localStorage (useAuth) — không cần đăng nhập lần hai. Tự poll dữ liệu
// riêng (useRaceData) vì mỗi BrowserWindow là một tiến trình renderer độc
// lập, không chia sẻ state React với cửa sổ chính.
export default function PopoutView({ sourceId }) {
  const { t } = useI18n();
  const { session } = useAuth();
  const onUnauthorized = useCallback(() => {}, []);
  const { data, selRun, setSelRun } = useRaceData(session, { onUnauthorized });
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Dong cua so nay. Ban desktop: dung mergeBack() thay vi closeThisWindow()
  // don thuan, vi mergeBack lam luon 2 viec trong 1 nut — dong popout VA dua
  // cua so chinh len truoc/focus — do do khong can them 1 nut rieng chi de
  // lam them mot viec nho (tach rieng "Gop lai" khoi "Dong" o ban truoc gay
  // roi, 2 nut lam viec gan nhu nhau).
  function close() {
    if (isDesktop()) mergeBack();
    else window.close();
  }

  if (!session) {
    return (
      <div className="popout-wrap popout-empty">
        <p>{t("popout.noSession")}</p>
      </div>
    );
  }

  const source = findSource(sourceId);
  const Comp = source.Component;

  return (
    <div className="popout-wrap">
      <div className="popout-head">
        <span className="mixer-tally on-air">{t("mix.pgm")}</span>
        <span className="popout-title">{source.icon} {t(source.labelKey)}</span>
        <span className="spacer" />
        <span className="popout-clock num">{now.toLocaleTimeString()}</span>
        <button className="btn ghost sm" onClick={close}>✕ {t("popout.close")}</button>
      </div>
      <div className="popout-body">
        <Comp {...source.props({ data, selRun, onSelect: setSelRun })} />
      </div>
    </div>
  );
}
