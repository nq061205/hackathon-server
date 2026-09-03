import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/I18nContext";

// Mau xe sang, hop nen toi (dong bo voi thanh mau doi o Live Timing).
const CAR_COLORS = ["#ff2b21", "#38bdf8", "#22c55e", "#eab308", "#a855f7", "#14b8a6", "#fb7185", "#84cc16",
  "#f97316", "#2dd4bf", "#818cf8", "#f43f5e", "#4ade80", "#facc15", "#c084fc", "#0ea5e9",
  "#e879f9", "#a3e635", "#f87171", "#60a5fa"];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ARENA_H = 360;
const TRAIL_MAX = 18;   // số điểm đuôi giữ lại cho mỗi xe (đuôi ngắn, không phủ kín track)
const OBST_MAX = 10;    // mốc vật cản giữ lại (chỉ vẽ cho xe đang chọn)

// Đọc vị trí thật từ ai_result (mỗi đội tự định nghĩa JSON — hỗ trợ vài tên trường phổ biến).
function parsePosition(ai) {
  if (!ai || typeof ai !== "object") return null;
  const n = (v) => typeof v === "number" && isFinite(v);
  const x = [ai.x, ai.pos_x, ai.px, ai.posX, ai.X].find(n);
  const y = [ai.y, ai.pos_y, ai.py, ai.posY, ai.Y].find(n);
  if (!n(x) || !n(y)) return null;
  const p = [ai.progress, ai.prog, ai.completion].find(n);
  const speed = [ai.speed_kmh, ai.speed, ai.v].find(n);
  return { x, y, progress: n(p) ? p : null, speed: n(speed) ? speed : null, obstacle: !!ai.obstacle };
}

export default function RaceTrack({ data, selRun, onSelect }) {
  const { t } = useI18n();
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const stateRef = useRef({ cars: [], selRun: null });
  const trailRef = useRef(new Map());   // runId -> [{x,y}] (world)
  const obstRef = useRef(new Map());    // runId -> [{x,y}] nơi báo vật cản
  const posRef = useRef(new Map());     // runId -> {sx,sy} (screen, mượt)
  const boundsRef = useRef(null);
  const clickRef = useRef(new Map());   // runId -> {sx,sy} để bắt click

  // Chuẩn bị xe đang chạy + vị trí thật (nếu có).
  const teamById = (id) => data.teams.find((x) => x.id === id) || {};
  const cars = data.runs
    .filter((r) => r.status === "running")
    .map((r) => {
      const tm = teamById(r.teamId);
      const it = data.latestByRun && data.latestByRun[r.id];
      const pos = parsePosition(it ? it.aiResult : null);
      return {
        runId: r.id, teamId: r.teamId, carId: tm.carId || "", name: tm.teamName || "?",
        color: CAR_COLORS[(r.teamId - 1 + CAR_COLORS.length) % CAR_COLORS.length], pos,
      };
    });
  const withPos = cars.filter((c) => c.pos);
  stateRef.current = { cars, selRun, hasData: withPos.length > 0, trackPath: data.trackPath || null };

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;
    const ctx = canvas.getContext("2d");
    let raf = 0, cssW = 0, cssH = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const fs = document.fullscreenElement === wrap;
      const w = wrap.clientWidth, h = fs ? wrap.clientHeight : ARENA_H;   // toàn màn hình -> lấp đầy
      if (w === cssW && h === cssH) return;
      cssW = w; cssH = h;
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function frame() {
      const { cars: cs, selRun: sel, trackPath } = stateRef.current;
      resize();
      ctx.clearRect(0, 0, cssW, cssH);

      // nền sân + lưới mờ (nen gan den, phang kieu f1dash)
      ctx.fillStyle = "#0d0d0f";
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.strokeStyle = "#1a1a1d"; ctx.lineWidth = 1;
      for (let gx = 0; gx < cssW; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, cssH); ctx.stroke(); }
      for (let gy = 0; gy < cssH; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(cssW, gy); ctx.stroke(); }

      const positioned = cs.filter((c) => c.pos);
      const alive = new Set(cs.map((c) => c.runId));
      for (const mref of [trailRef, obstRef, posRef, clickRef]) for (const k of [...mref.current.keys()]) if (!alive.has(k)) mref.current.delete(k);

      if (positioned.length === 0) {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "600 15px 'Geist', 'Inter', system-ui, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(cs.length ? t("track.waiting") : t("track.empty"), cssW / 2, cssH / 2);
        raf = requestAnimationFrame(frame);
        return;
      }

      // cập nhật vệt + mốc vật cản (theo world coords)
      positioned.forEach((c) => {
        const tr = trailRef.current.get(c.runId) || [];
        const last = tr[tr.length - 1];
        if (!last || Math.hypot(c.pos.x - last.x, c.pos.y - last.y) > 0.001) {
          tr.push({ x: c.pos.x, y: c.pos.y });
          if (tr.length > TRAIL_MAX) tr.shift();   // đuôi ngắn kiểu "sao chổi" — nền track đã vẽ sẵn cả vòng
          trailRef.current.set(c.runId, tr);
        }
        if (c.pos.obstacle) {
          const om = obstRef.current.get(c.runId) || [];
          const ol = om[om.length - 1];
          if (!ol || Math.hypot(c.pos.x - ol.x, c.pos.y - ol.y) > 0.001) {
            om.push({ x: c.pos.x, y: c.pos.y }); if (om.length > OBST_MAX) om.shift();
            obstRef.current.set(c.runId, om);
          }
        }
      });

      // auto-fit bounds (chỉ mở rộng để view ổn định)
      let b = boundsRef.current;
      const pts = [];
      positioned.forEach((c) => { pts.push(c.pos); const tr = trailRef.current.get(c.runId); if (tr) for (const p of tr) pts.push(p); });
      if (trackPath) for (const p of trackPath) pts.push(p);   // khung ôm trọn track ngay từ đầu (hết giật)
      for (const p of pts) {
        if (!b) b = { minX: p.x, maxX: p.x, minY: p.y, maxY: p.y };
        b.minX = Math.min(b.minX, p.x); b.maxX = Math.max(b.maxX, p.x);
        b.minY = Math.min(b.minY, p.y); b.maxY = Math.max(b.maxY, p.y);
      }
      boundsRef.current = b;
      const m = 30;
      const spanX = Math.max(1e-6, b.maxX - b.minX), spanY = Math.max(1e-6, b.maxY - b.minY);
      const scale = Math.min((cssW - 2 * m) / spanX, (cssH - 2 * m) / spanY);
      const ox = (cssW - spanX * scale) / 2, oy = (cssH - spanY * scale) / 2;
      const sx = (x) => ox + (x - b.minX) * scale;
      const sy = (y) => oy + (y - b.minY) * scale;

      // nền đường đua (nếu biết track — hiện có ở demo; live sẽ có khi backend cấp sơ đồ sân)
      if (trackPath && trackPath.length > 1) {
        ctx.lineJoin = "round"; ctx.lineCap = "round";
        ctx.strokeStyle = "#26262b"; ctx.lineWidth = 18;   // mat duong asphalt
        ctx.beginPath();
        trackPath.forEach((p, i) => { const X = sx(p.x), Y = sy(p.y); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
        ctx.stroke();
        ctx.strokeStyle = "rgba(148,163,184,.45)"; ctx.lineWidth = 2.5; ctx.setLineDash([7, 11]);   // vach tim duong
        ctx.beginPath();
        trackPath.forEach((p, i) => { const X = sx(p.x), Y = sy(p.y); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
        ctx.stroke(); ctx.setLineDash([]);
      }

      // xếp hạng theo progress nếu có
      const haveProg = positioned.every((c) => c.pos.progress != null);
      const rankOf = new Map();
      if (haveProg) {
        positioned.slice().sort((a, z) => z.pos.progress - a.pos.progress).forEach((c, i) => rankOf.set(c.runId, i + 1));
      }

      // vệt (đuôi sao chổi) — GỘP nét: mỗi xe chỉ stroke() MỘT lần (trước đây stroke mỗi điểm → lag)
      positioned.forEach((c) => {
        const tr = trailRef.current.get(c.runId); if (!tr || tr.length < 2) return;
        const isSel = c.runId === sel;
        ctx.strokeStyle = c.color + (isSel ? "cc" : "3a");
        ctx.lineWidth = isSel ? 3 : 2;
        ctx.beginPath();
        let started = false, px = 0, py = 0;
        for (const p of tr) {
          const X = sx(p.x), Y = sy(p.y);
          if (started && Math.hypot(X - px, Y - py) > 120) started = false;   // ngắt khi nhảy (vòng lại)
          if (!started) { ctx.moveTo(X, Y); started = true; } else ctx.lineTo(X, Y);
          px = X; py = Y;
        }
        ctx.stroke();
      });

      // mốc vật cản — chỉ vẽ cho xe ĐANG CHỌN (tránh rối cả bản đồ)
      const selObst = sel != null ? obstRef.current.get(sel) : null;
      if (selObst) {
        for (const o of selObst) {
          const X = sx(o.x), Y = sy(o.y);
          ctx.fillStyle = "#f97316";
          ctx.beginPath(); ctx.moveTo(X, Y - 7); ctx.lineTo(X - 6, Y + 5); ctx.lineTo(X + 6, Y + 5); ctx.closePath(); ctx.fill();
        }
      }

      // xe
      clickRef.current.clear();
      positioned.forEach((c) => {
        const isSel = c.runId === sel;
        const tX = sx(c.pos.x), tY = sy(c.pos.y);
        const p = posRef.current.get(c.runId) || { sx: tX, sy: tY };
        p.sx += (tX - p.sx) * 0.25; p.sy += (tY - p.sy) * 0.25;
        posRef.current.set(c.runId, p);
        clickRef.current.set(c.runId, { sx: p.sx, sy: p.sy });

        // heading từ vệt
        const tr = trailRef.current.get(c.runId);
        let ang = 0;
        if (tr && tr.length >= 2) { const a = tr[tr.length - 2], z = tr[tr.length - 1]; ang = Math.atan2(sy(z.y) - sy(a.y), sx(z.x) - sx(a.x)); }

        ctx.save(); ctx.translate(p.sx, p.sy); ctx.rotate(ang);
        if (isSel) { ctx.shadowColor = c.color; ctx.shadowBlur = 14; }
        ctx.fillStyle = c.pos.obstacle ? "#dc2626" : c.color;
        const w = isSel ? 26 : 22, h = isSel ? 13 : 11, r = 3;
        ctx.beginPath();
        ctx.moveTo(-w / 2 + r, -h / 2); ctx.arcTo(w / 2, -h / 2, w / 2, h / 2, r);
        ctx.arcTo(w / 2, h / 2, -w / 2, h / 2, r); ctx.arcTo(-w / 2, h / 2, -w / 2, -h / 2, r);
        ctx.arcTo(-w / 2, -h / 2, w / 2, -h / 2, r); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fillRect(w / 2 - 8, -h / 2 + 2, 5, h - 4);
        if (isSel) { ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5; ctx.stroke(); }
        ctx.restore();

        // nhãn
        ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        ctx.font = "700 12px 'Geist', 'Inter', system-ui, sans-serif";
        const rk = rankOf.get(c.runId);
        ctx.fillStyle = rk === 1 ? "#fbbf24" : "#cbd5e1";
        const label = (rk ? "P" + rk + " " : "") + c.carId;
        ctx.fillText(label, p.sx, p.sy - (isSel ? 12 : 10));
        if (isSel && c.pos.speed != null) {
          ctx.fillStyle = "#94a3b8"; ctx.textBaseline = "top";
          ctx.font = "400 11px 'Geist Mono', 'JetBrains Mono', monospace";
          ctx.fillText(Math.round(c.pos.speed) + " km/h", p.sx, p.sy + 12);
        }
      });

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    const onResize = () => { cssW = 0; };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, [t]);

  function onClick(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let best = null, bd = 1e9;
    clickRef.current.forEach((p, runId) => { const d = Math.hypot(p.sx - mx, p.sy - my); if (d < bd) { bd = d; best = runId; } });
    if (best != null && bd < 40 && onSelect) onSelect(best);
  }

  function expand() {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    const p = el.requestFullscreen ? el.requestFullscreen() : null;
    if (p && p.catch) p.catch((err) => console.error("[RaceTrack] requestFullscreen that bai:", err));
  }

  return (
    <div className="panel track-panel">
      <div className="head">
        <div className="title">{t("track.title")}<small>{t("track.hint")}</small></div>
        <span className="spacer" />
        <div className="map-tools">
          <div className="map-toggle">
            <button className="mt on">2D</button>
            <button className="mt" disabled title="—">3D</button>
            <button className="mt" disabled title="—">SAT</button>
          </div>
          <button className="btn sm" onClick={expand}>{t("track.expand")}</button>
        </div>
      </div>
      <div className="track-wrap" ref={wrapRef}>
        <canvas ref={canvasRef} onClick={onClick} style={{ cursor: "pointer", display: "block" }} />
      </div>
    </div>
  );
}
