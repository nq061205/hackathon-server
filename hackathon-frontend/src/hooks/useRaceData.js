import { useEffect, useRef, useState, useCallback } from "react";
import { createDemoEngine } from "../lib/demoEngine";
import { makeClient } from "../lib/api";
import { createRaceSocket } from "../lib/ws";

const EMPTY = { teams: [], runs: [], board: [], statsByRun: {}, logsByRun: {}, latestByRun: {}, audit: [] };

// Backend trả ai_result dạng chuỗi JSON; chuẩn hoá thành object để dùng.
function parseAi(it) {
  let ai = it.aiResult;
  if (typeof ai === "string") { try { ai = JSON.parse(ai); } catch { ai = {}; } }
  return { ...it, aiResult: ai || {} };
}

function toLatestByRun(list) {
  const out = {};
  for (const it of list || []) out[it.runId] = parseAi(it);
  return out;
}

/**
 * Du lieu dua theo phien:
 *  - mode 'demo': dung bo sinh gia lap cuc bo (khong lien quan backend that),
 *    van tu poll nhu truoc.
 *  - mode 'live': goi REST DUY NHAT 1 LAN de co du lieu ngay khi mo app, sau
 *    do nhan cap nhat lien tuc qua WebSocket (topic /topic/race-data, backend
 *    day moi ~500ms cho MOI client cung luc — xem ws.RaceDataBroadcaster).
 *    Nghia la moi cua so (chinh + cac cua so da "tach ra" qua lib/desktop.js)
 *    deu goi hook nay va deu nhan CUNG 1 goi tin tai CUNG 1 thoi diem, thay
 *    vi truoc day moi cua so tu poll REST rieng theo dong ho cua no (kieu he
 *    thong TCDS cua pit wall F1 — xem thao luan trong README-DESKTOP.md).
 *
 *    Luot dang xem (selRun) neu KHONG con 'running' (vd giam khao xem lai 1
 *    luot da xong) se khong nam trong goi WebSocket (broadcaster chi tinh
 *    luot dang chay) -> tu fetch REST rieng khi selRun doi sang luot do.
 *
 *    session.role === 'admin' -> subscribe them /topic/admin/audit (nhat ky
 *    thao tac, chi admin) vao data.audit — AdminConsole doc thang tu day,
 *    khong tu poll rieng nua.
 *
 *  Gap 401 (REST) -> goi onUnauthorized (dang xuat).
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
    let ws = null;

    // reset khi doi phien
    selRef.current = null;
    setSelRunState(null);
    setData(EMPTY);
    engineRef.current = session.mode === "demo" ? createDemoEngine() : null;
    const client = session.mode === "live" ? makeClient(session.api, session.token) : null;

    async function pollDemo() {
      const eng = engineRef.current;
      if (!selRef.current) {
        const f = eng.firstRunningId();
        if (f) { selRef.current = f; setSelRunState(f); }
      }
      const snap = eng.pull(selRef.current);
      if (alive) { setData((d) => ({ ...snap, audit: d.audit })); setOnline(true); }
    }

    // Tai du lieu qua REST — dung cho lan dau khi mo app (truoc khi WebSocket
    // kip ket noi) va lam fallback neu WS loi.
    async function fetchLiveOnce() {
      try {
        const [teams, runs, board] = await Promise.all([client.teams(), client.runs(), client.leaderboard()]);
        const running = runs.filter((r) => r.status === "running");
        if (!selRef.current && running.length) { selRef.current = running[0].id; setSelRunState(running[0].id); }

        const statsByRun = {};
        const logsByRun = {};
        if (selRef.current) {
          try {
            const stats = await client.runStats(selRef.current);
            statsByRun[selRef.current] = stats;
            if (withLogs) {
              const size = 40;
              const page = Math.max(0, Math.ceil(stats.logCount / size) - 1);
              const res = await client.runLogs(selRef.current, page, size);
              logsByRun[selRef.current] = (res.content || []).slice().reverse().map(parseAi);
            }
          } catch { /* skip */ }
        }

        let latestByRun = {};
        try { latestByRun = toLatestByRun(await client.liveLatest()); } catch { /* skip */ }

        if (alive) {
          setData((d) => ({
            ...d, teams, runs, board,
            statsByRun: { ...d.statsByRun, ...statsByRun },
            logsByRun: { ...d.logsByRun, ...logsByRun },
            latestByRun: { ...d.latestByRun, ...latestByRun },
          }));
          setOnline(true);
        }
      } catch (e) {
        if (e && e.status === 401) { if (onUnauthorized) onUnauthorized(); return; }
        if (alive) setOnline(false);
      }
    }

    if (session.mode === "demo") {
      pollRef.current = pollDemo;
      pollDemo();
      timer = setInterval(pollDemo, 1400);
    } else {
      pollRef.current = fetchLiveOnce;
      fetchLiveOnce(); // tai lan dau qua REST

      ws = createRaceSocket(session.api, session.token);
      ws.onWebSocketClose = () => { if (alive) setOnline(false); };
      ws.onStompError = () => { if (alive) setOnline(false); };
      ws.onConnect = () => {
        if (!alive) return;
        setOnline(true);

        ws.subscribe("/topic/race-data", (msg) => {
          if (!alive) return;
          try {
            const push = JSON.parse(msg.body);
            const logsByRunRaw = push.logsByRun || {};
            const logsByRun = {};
            for (const rid of Object.keys(logsByRunRaw)) {
              logsByRun[rid] = (logsByRunRaw[rid] || []).map(parseAi);
            }

            setData((d) => ({
              ...d,
              teams: push.teams || d.teams,
              runs: push.runs || d.runs,
              board: push.board || d.board,
              statsByRun: { ...d.statsByRun, ...(push.statsByRun || {}) },
              logsByRun: { ...d.logsByRun, ...logsByRun },
              latestByRun: toLatestByRun(push.latestByRun),
            }));
            setOnline(true);

            // Chua chon luot nao -> tu chon luot dang running dau tien, giong
            // hanh vi REST cu.
            if (!selRef.current) {
              const running = (push.runs || []).find((r) => r.status === "running");
              if (running) { selRef.current = running.id; setSelRunState(running.id); }
            }
          } catch { /* bo qua goi loi */ }
        });

        if (session.role === "admin") {
          ws.subscribe("/topic/admin/audit", (msg) => {
            if (!alive) return;
            try {
              const push = JSON.parse(msg.body);
              setData((d) => ({ ...d, audit: push.content || [] }));
            } catch { /* bo qua goi loi */ }
          });
        }
      };
      ws.activate();
    }

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      if (ws) ws.deactivate();
      pollRef.current = null;
    };
  }, [session, onUnauthorized, withLogs]);

  // selRun tro toi 1 luot chua co du lieu (vd luot da xong -> khong nam
  // trong goi WebSocket, vi broadcaster chi tinh luot 'running') -> tu fetch
  // rieng qua REST cho dung luot do.
  useEffect(() => {
    if (!session || session.mode !== "live" || !selRun) return undefined;
    if (data.statsByRun[selRun]) return undefined;
    let alive = true;
    const client = makeClient(session.api, session.token);
    (async () => {
      try {
        const stats = await client.runStats(selRun);
        let logs = [];
        if (withLogs) {
          const size = 40;
          const page = Math.max(0, Math.ceil(stats.logCount / size) - 1);
          const res = await client.runLogs(selRun, page, size);
          logs = (res.content || []).slice().reverse().map(parseAi);
        }
        if (alive) {
          setData((d) => ({
            ...d,
            statsByRun: { ...d.statsByRun, [selRun]: stats },
            logsByRun: { ...d.logsByRun, [selRun]: logs },
          }));
        }
      } catch { /* skip */ }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selRun, session, withLogs]);

  const refresh = useCallback(() => { if (pollRef.current) pollRef.current(); }, []);

  return { data, online, selRun, setSelRun, refresh };
}
