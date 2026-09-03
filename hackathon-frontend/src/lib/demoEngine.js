// Bo sinh du lieu DEMO: gia lap mot cuoc dua dang dien ra de xem giao dien
// khi chua noi backend (vd trang publish khong goi duoc localhost).
// pull(selRun) tra ve snapshot: { teams, runs, board, statsByRun, logsByRun }.

const NAMES = [
  ["Sấm Sét", "car01"], ["Bão Tố", "car02"], ["Tia Chớp", "car03"], ["Rồng Lửa", "car04"],
  ["Hắc Báo", "car05"], ["Cuồng Phong", "car06"], ["Mãnh Hổ", "car07"], ["Sao Băng", "car08"],
];

// Đường mê cung (toạ độ chuẩn hoá 0..1), dạng vòng để xe chạy liên tục trong demo.
const MAZE = [
  [0.06, 0.18], [0.94, 0.18], [0.94, 0.40], [0.06, 0.40],
  [0.06, 0.62], [0.94, 0.62], [0.94, 0.84], [0.06, 0.84],
  [0.03, 0.84], [0.03, 0.18], [0.06, 0.18],
];
const SEG = (() => {
  const s = []; let total = 0;
  for (let i = 1; i < MAZE.length; i++) {
    const len = Math.hypot(MAZE[i][0] - MAZE[i - 1][0], MAZE[i][1] - MAZE[i - 1][1]);
    s.push({ len, acc: total }); total += len;
  }
  return { s, total };
})();
// Toạ độ track ở "đơn vị thế giới" giống vị trí xe (để bản đồ vẽ nền + tính khung).
const TRACK_PATH = MAZE.map(([x, y]) => ({ x: +(x * 1000).toFixed(1), y: +(y * 600).toFixed(1) }));
function pointOn(p) {
  p = ((p % 1) + 1) % 1;
  const target = p * SEG.total;
  let i = 0;
  while (i < SEG.s.length - 1 && SEG.s[i].acc + SEG.s[i].len < target) i++;
  const seg = SEG.s[i], f = seg.len ? (target - seg.acc) / seg.len : 0;
  const a = MAZE[i], b = MAZE[i + 1];
  return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f };
}

// Telemetry + vị trí (x,y) mô phỏng tại tiến độ prog trên mê cung.
function aiResult(prog, speedKmh) {
  const pos = pointOn(prog);
  return {
    x: +(pos.x * 1000).toFixed(1),          // toạ độ "đơn vị bất kỳ" — bản đồ tự co giãn
    y: +(pos.y * 600).toFixed(1),
    progress: +prog.toFixed(4),
    speed_kmh: +speedKmh.toFixed(1),
    steering_deg: +(-25 + Math.random() * 50).toFixed(1),
    lane_offset_cm: +(-15 + Math.random() * 30).toFixed(1),
    obstacle: Math.random() < 0.05,
    confidence: +(0.85 + Math.random() * 0.14).toFixed(3),
  };
}

export function createDemoEngine() {
  const now0 = Date.now();
  const teams = NAMES.map((n, i) => ({
    id: i + 1, teamName: "Đội " + n[0], carId: n[1],
    username: "team" + String(i + 1).padStart(2, "0"), active: true,
  }));
  const runs = [];
  const seq = {}, logs = {}, started = {}, lost = {}, prog = {}, spd = {};

  teams.forEach((tm, i) => {
    const rid = 100 + i;
    if (i < 6) {
      const st = now0 - (8000 + i * 400);
      runs.push({ id: rid, teamId: tm.id, heatNo: 1, startedAt: st, endedAt: null, status: "running" });
      seq[rid] = Math.floor(400 + Math.random() * 300); logs[rid] = []; started[rid] = st;
      prog[rid] = i * 0.12; spd[rid] = 14 + Math.random() * 22;   // vị trí xuất phát rải + tốc độ nền
    } else {
      const dur = 30000 + Math.floor(Math.random() * 15000);
      runs.push({ id: rid, teamId: tm.id, heatNo: 1, startedAt: now0 - 90000, endedAt: now0 - 90000 + dur, status: "finished", _dur: dur });
      seq[rid] = Math.floor(dur / 10); logs[rid] = [];
    }
  });

  function tick() {
    const now = Date.now();
    for (const r of runs) {
      if (r.status !== "running") continue;
      const rid = r.id;
      const add = 6 + Math.floor(Math.random() * 10);
      // đổi tốc độ mượt + tiến trên mê cung
      spd[rid] = Math.max(6, Math.min(38, spd[rid] + (Math.random() - 0.5) * 6));
      prog[rid] = (prog[rid] + 0.03 * (spd[rid] / 25)) % 1;
      for (let j = 0; j < add; j++) {
        if (Math.random() < 0.012) { lost[rid] = (lost[rid] || 0) + 1; seq[rid]++; continue; }
        const s = seq[rid]++;
        const base = 8 + Math.random() * 22;
        const spike = Math.random() < 0.06 ? 40 + Math.random() * 80 : 0;
        const lat = Math.round(base + spike);
        logs[rid].push({ runId: rid, teamId: r.teamId, sequenceNo: s, carTimestamp: now - lat, receivedAt: now, latencyMs: lat, aiResult: aiResult(prog[rid], spd[rid]) });
      }
      if (logs[rid].length > 120) logs[rid] = logs[rid].slice(-120);
    }
    if (Math.random() < 0.03) {
      const running = runs.filter((r) => r.status === "running");
      if (running.length > 3) {
        const r = running[Math.floor(Math.random() * running.length)];
        r.status = "finished"; r.endedAt = now; r._dur = now - started[r.id];
      }
    }
  }

  function statsFor(rid) {
    const arr = logs[rid] || [];
    const r = runs.find((x) => x.id === rid);
    const count = seq[rid] ? seq[rid] - (lost[rid] || 0) : arr.length;
    const lats = arr.map((x) => x.latencyMs);
    const avg = lats.length ? lats.reduce((a, b) => a + b, 0) / lats.length : null;
    return {
      runId: rid, status: r ? r.status : "", logCount: count,
      avgLatencyMs: avg, minLatencyMs: lats.length ? Math.min(...lats) : null, maxLatencyMs: lats.length ? Math.max(...lats) : null,
      minSeq: 0, maxSeq: seq[rid] - 1, lostEstimate: lost[rid] || 0,
      durationMs: r && r.status !== "running" ? (r._dur || null) : (Date.now() - (started[rid] || Date.now())),
    };
  }

  function board() {
    return teams.map((tm) => {
      const rs = runs.filter((r) => r.teamId === tm.id);
      const fin = rs.filter((r) => r.status === "finished");
      const best = fin.length ? Math.min(...fin.map((r) => r._dur || Infinity)) : null;
      const total = rs.reduce((a, r) => a + (seq[r.id] || 0), 0);
      return {
        teamId: tm.id, teamName: tm.teamName, carId: tm.carId, active: tm.active,
        finishedRuns: fin.length, bestDurationMs: (best && isFinite(best)) ? best : null, totalLogs: total,
      };
    }).sort((a, b) => (a.bestDurationMs ?? Infinity) - (b.bestDurationMs ?? Infinity));
  }

  return {
    firstRunningId() {
      const r = runs.find((x) => x.status === "running");
      return r ? r.id : null;
    },
    pull(selRun) {
      tick();
      const statsByRun = {};
      for (const r of runs) if (r.status === "running" || r.id === selRun) statsByRun[r.id] = statsFor(r.id);
      const logsByRun = {};
      if (selRun) logsByRun[selRun] = (logs[selRun] || []).slice(-40).reverse();
      // Telemetry mới nhất của TỪNG xe đang chạy (cho đường đua mô phỏng).
      const latestByRun = {};
      for (const r of runs) {
        if (r.status !== "running") continue;
        const arr = logs[r.id];
        if (arr && arr.length) latestByRun[r.id] = arr[arr.length - 1];
      }
      return {
        teams,
        runs: runs.map((r) => ({ id: r.id, teamId: r.teamId, heatNo: r.heatNo, startedAt: r.startedAt, endedAt: r.endedAt, status: r.status })),
        board: board(),
        statsByRun,
        logsByRun,
        latestByRun,
        trackPath: TRACK_PATH,   // demo: đường mê cung để vẽ nền
      };
    },
  };
}
