import { useI18n } from "../i18n/I18nContext";
import { Trophy } from "../lib/sprites";
import { fmtMs, fmtInt } from "../lib/format";

export default function Leaderboard({ board, simple = false }) {
  const { t } = useI18n();
  const rows = board || [];

  return (
    <div className="panel">
      <div className="head">
        <Trophy u={3} />
        <div className="title">{t("board.title")}</div>
      </div>
      <div className="board">
        {rows.length === 0 && <div className="empty">{t("empty.board")}</div>}
        {rows.slice(0, 8).map((row, i) => {
          const time = row.bestDurationMs != null ? fmtMs(row.bestDurationMs) : "—";
          return (
            <div key={row.teamId} className={`rank p${i + 1}`}>
              <div className="pos">{i + 1}</div>
              <div className="who">
                {row.teamName}
                <small className="num">{row.carId} · {simple ? "" : fmtInt(row.totalLogs) + " pkt · "}{row.finishedRuns} {t("m.heat").toLowerCase()}</small>
              </div>
              <div className={`time ${row.bestDurationMs == null ? "none" : ""}`}>{time}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
