import { useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import { SOURCES, findSource } from "../lib/sources";
import { isDesktop, openPopout } from "../lib/desktop";

// Bộ chuyển cảnh kiểu vMix/TriCaster: lưới các "nguồn" (mỗi ô là một component
// đã có trong Dashboard, thu nhỏ lại nhưng vẫn sống — cùng dữ liệu, tự cập
// nhật), một ô đang XEM TRƯỚC (viền xanh) và một ô đang PHÁT SÓNG (viền đỏ,
// hiện to ở khối trên). Bấm một ô = chọn xem trước; bấm TAKE (hoặc bấm đúp
// vào ô) = đẩy ô đó lên phát sóng ngay.
export default function Switcher({ data, selRun, onSelect, programId, onProgramChange }) {
  const { t } = useI18n();
  const [previewId, setPreviewId] = useState(() => {
    const idx = SOURCES.findIndex((s) => s.id === programId);
    return SOURCES[(idx + 1) % SOURCES.length].id;
  });
  const [popping, setPopping] = useState(false);

  const ctx = { data, selRun, onSelect };
  const program = findSource(programId);
  const ProgramComp = program.Component;
  const preview = findSource(previewId);
  const PreviewComp = preview.Component;

  function take() {
    if (previewId !== programId) onProgramChange(previewId);
  }

  async function handlePopout() {
    if (popping) return;
    setPopping(true);
    await openPopout(programId);
    setPopping(false);
  }

  return (
    <div className="mixer">
      <div className="mixer-monitors">
        {/* XEM TRUOC (trai) */}
        <div className="mixer-mon mixer-pvw-mon">
          <div className="mixer-pgm-head">
            <span className="mixer-tally preview">{t("mix.pvw")}</span>
            <span className="mixer-pgm-title">
              {preview.icon} {t(preview.labelKey)}
            </span>
          </div>
          <div className="mixer-pgm-body">
            <PreviewComp {...preview.props(ctx)} />
          </div>
        </div>

        {/* TAKE (giua) */}
        <div className="mixer-take-col">
          <span className="mixer-take-arrow">▶</span>
          <button
            className="btn on mixer-take-btn"
            onClick={take}
            disabled={previewId === programId}
          >
            {t("mix.take")}
          </button>
        </div>

        {/* PHAT SONG (phai) */}
        <div className="mixer-mon mixer-pgm">
          <div className="mixer-pgm-head">
            <span className="mixer-tally on-air">{t("mix.pgm")}</span>
            <span className="mixer-pgm-title">
              {program.icon} {t(program.labelKey)}
            </span>
            <span className="spacer" />
            <button
              className="btn ghost sm"
              disabled={!isDesktop() || popping}
              title={isDesktop() ? t("mix.popout.hint") : t("mix.popout.web")}
              onClick={handlePopout}
            >
              ⇱ {t("mix.popout")}
            </button>
          </div>
          <div className="mixer-pgm-body">
            <ProgramComp {...program.props(ctx)} />
          </div>
        </div>
      </div>

      <div className="mixer-bus">
        <div className="mixer-grid">
          {SOURCES.map((s) => {
            const isPgm = s.id === programId;
            const isPvw = s.id === previewId;
            const Comp = s.Component;
            return (
              <div
                key={s.id}
                className={`mixer-tile ${isPgm ? "on-pgm" : ""} ${isPvw && !isPgm ? "on-pvw" : ""}`}
                role="button"
                tabIndex={0}
                title={t("mix.tile.hint")}
                onClick={() => setPreviewId(s.id)}
                onDoubleClick={() => onProgramChange(s.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setPreviewId(s.id);
                  if (e.key === " ") { e.preventDefault(); onProgramChange(s.id); }
                }}
              >
                <div className="mixer-tile-head">
                  <span className="mixer-tile-icon">{s.icon}</span>
                  <span className="mixer-tile-label">{t(s.labelKey)}</span>
                  {isPgm && <span className="mixer-chip pgm">{t("mix.pgm")}</span>}
                  {isPvw && !isPgm && <span className="mixer-chip pvw">{t("mix.pvw")}</span>}
                </div>
                <div className="mixer-tile-thumb">
                  <div className="mixer-tile-scale">
                    <Comp {...s.props(ctx)} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
