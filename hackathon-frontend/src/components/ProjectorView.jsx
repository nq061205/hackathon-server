import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import RaceTrack from "./RaceTrack";
import Leaderboard from "./Leaderboard";

/** Chế độ màn chiếu: Bản đồ ↔ Bảng xếp hạng, chữ to, có nút toàn màn hình.
 *  Chuyển tay bằng cách bấm vào 2 chấm; tự chuyển sang bảng xếp hạng khi có xe về đích. */
export default function ProjectorView({ data, selRun, onSelect }) {
  const { t } = useI18n();
  const [idx, setIdx] = useState(0);
  const boxRef = useRef(null);
  const prevRunningRef = useRef(null);

  // Xe về đích (run rời khỏi trạng thái "running") -> tự bật bảng xếp hạng.
  useEffect(() => {
    const runningIds = new Set(data.runs.filter((r) => r.status === "running").map((r) => r.id));
    const prev = prevRunningRef.current;
    if (prev) {
      for (const id of prev) {
        if (!runningIds.has(id)) { setIdx(1); break; }
      }
    }
    prevRunningRef.current = runningIds;
  }, [data.runs]);

  function toggleFs() {
    const el = boxRef.current;
    if (!el) return;
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    const p = el.requestFullscreen ? el.requestFullscreen() : null;
    if (p && p.catch) p.catch((err) => console.error("[ProjectorView] requestFullscreen that bai:", err));
  }

  return (
    <div className="projector" ref={boxRef}>
      <div className="proj-head">
        <span className="proj-title">{idx === 0 ? t("proj.now") : t("proj.rank")}</span>
        <div className="proj-dots">
          <span className={idx === 0 ? "on" : ""} onClick={() => setIdx(0)} />
          <span className={idx === 1 ? "on" : ""} onClick={() => setIdx(1)} />
        </div>
        <button className="btn sm" onClick={toggleFs}>{t("proj.fs")}</button>
      </div>
      <div className="proj-body">
        {idx === 0
          ? <RaceTrack data={data} selRun={selRun} onSelect={onSelect} />
          : <Leaderboard board={data.board} simple />}
      </div>
    </div>
  );
}
