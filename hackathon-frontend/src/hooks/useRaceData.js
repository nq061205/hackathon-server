import { useEffect, useRef, useState, useCallback } from "react";
import { createDemoEngine } from "../lib/demoEngine";
import { makeClient } from "../lib/api";

const EMPTY = { teams: [], runs: [], board: [], statsByRun: {}, logsByRun: {}, latestByRun: {} };

// Backend trả ai_result dạng chuỗi JSON; chuẩn hoá thành object để dùng.
function parseAi(it) {
  let ai = it.aiResult;
  if (typeof ai === "string") { try { ai = JSON.parse(ai); } catch { ai = {}; } }
  return { ...it, aiResult: ai || {} };
}

/**
 * Poll du lieu dua theo phien:
 *  - mode 'demo': dung bo sinh gia lap cuc bo.
 *  - mode 'live': goi backend (teams/runs/leaderboard + stats moi run + logs cua run dang chon).
 * Tra ve { data, online, selRun, setSelRun }. Gap 401 -> goi onUnauthorized (dang xuat).
 */
export function useRaceData(session, { onUnauthorized, withLogs = true } = {}) {
  const [data, setData] = useState(EMPTY);
  const [online, setOnline] = useState(true);
  const [selRun, setSelRunState] = useState(null);
  const selRef = useRef(null);
  const engineRef = useRef(null);
  const pollRef = useRef(null);

  const setSelRun = useCallback((id) => {
    selRef.current = id;
    setSelRunState(id);
  }, []);

  useEffect(() => {
    if (!session) return undefined;
    let alive = true;
    let timer = null;

    // reset khi doi phien
    selRef.current = null;
    setSelRunState(null);
    setData(EMPTY);
    engineRef.current = session.mode === "demo" ? createDemoEngine() : null;
    const client = session.mode === "live" ? makeClient(session.api, session.token) : null;
    const intervalMs = session.mode === "demo" ? 1400 : 1500;

    async function pollDemo() {
      const eng = engineRef.current;
      if (!selRef.current) {
        const f = eng.firstRunningId();
        if (f) { selRef.current = f; setSelRunState(f); }
      }
      const snap = eng.pull(selRef.current);
      if (alive) { setData(snap); setOnline(true); }
    }

    async function pollLive() {
      try {
        const [teams, runs, board] = await Promise.all([client.teams(), client.runs(), client.leaderboard()]);
        const running = runs.filter((r) => r.status === "running");
        if (!selRef.current && running.length) { selRef.current = running[0].id; setSelRunState(running[0].id); }

        const ids = new Set(running.map((r) => r.id));
        if (selRef.current) ids.add(selRef.current);
        const statsByRun = {};
        await Promise.all([...ids].map(async (id) => {
          try { statsByRun[id] = await client.runStats(id); } catch { /* skip */ }
        }));

        const logsByRun = {};
        if (withLogs && selRef.current) {
          const st = statsByRun[selRef.current];
          const size = 40;
          const total = st ? st.logCount : 0;
          const page = Math.max(0, Math.ceil(total / size) - 1);
          try {
            const res = await client.runLogs(selRef.current, page, size);
            logsByRun[selRef.current] = (res.content || []).slice().reverse().map(parseAi);
          } catch { /* skip */ }
        }

        // Vị trí mới nhất của MỌI xe đang chạy (1 request) — cho bản đồ realtime.
        const latestByRun = {};
        try {
          const latest = await client.liveLatest();
          for (const it of latest || []) latestByRun[it.runId] = parseAi(it);
        } catch {
          // endpoint chưa có (backend cũ) -> fallback: chỉ xe đang chọn
          if (selRef.current && logsByRun[selRef.current] && logsByRun[selRef.current].length) {
            latestByRun[selRef.current] = logsByRun[selRef.current][0];
          }
        }
        if (alive) { setData({ teams, runs, board, statsByRun, logsByRun, latestByRun }); setOnline(true); }
      } catch (e) {
        if (e && e.status === 401) { if (onUnauthorized) onUnauthorized(); return; }
        if (alive) setOnline(false);
      }
    }

    const poll = session.mode === "demo" ? pollDemo : pollLive;
    pollRef.current = poll;
    poll();
    timer = setInterval(poll, intervalMs);

    return () => { alive = false; if (timer) clearInterval(timer); pollRef.current = null; };
  }, [session, onUnauthorized, withLogs]);

  const refresh = useCallback(() => { if (pollRef.current) pollRef.current(); }, []);

  return { data, online, selRun, setSelRun, refresh };
}
