import { useI18n } from "../i18n/I18nContext";
import { Flag } from "../lib/sprites";

// Dải tiêu đề cuộc đua kiểu f1dash: cờ + nhãn phụ + tên giải + trạng thái TRACK/FEED.
export default function RaceHeader({ data, online }) {
  const { t } = useI18n();
  const running = data.runs.filter((r) => r.status === "running").length;
  const trackOn = running > 0;

  return (
    <header className="rhead">
      <span className="rhead-flag"><Flag u={5} /></span>
      <div className="rhead-mid">
        <div className="rhead-eyebrow">{t("rh.eyebrow")} <b>·</b> {t("rh.kind")}</div>
        <h1 className="rhead-title">{t("rh.title")}</h1>
      </div>
      <div className="rhead-status">
        <div className="rst">
          <span className="rst-k">{t("rh.track")}</span>
          <span className="rst-v"><i className={`d ${trackOn ? "go" : "idle"}`} />{trackOn ? t("rh.green") : t("rh.hold")}</span>
        </div>
        <div className="rst">
          <span className="rst-k">{t("rh.feed")}</span>
          <span className="rst-v"><i className={`d ${online ? "live" : "off"}`} />{online ? t("rh.online") : t("rh.offline")}</span>
        </div>
      </div>
    </header>
  );
}
