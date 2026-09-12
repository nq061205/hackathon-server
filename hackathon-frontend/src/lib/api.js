// Lop goi API toi backend Spring Boot. KHONG hardcode URL trong component -
// luon dung cac ham o day. base = goc API (vd http://localhost:8080) hoac ""
// (cung goc, dung khi co dev proxy hoac frontend duoc backend phuc vu).

function joinUrl(base, path) {
  const b = (base || "").replace(/\/$/, "");
  return b + path;
}

async function request(base, path, token, opts = {}) {
  const res = await fetch(joinUrl(base, path), {
    ...opts,
    cache: "no-store", // du lieu doi lien tuc (polling) -> khong de trinh duyet dung ban cache cu
    headers: {
      Accept: "application/json",
      ...(opts.headers || {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
  });
  if (!res.ok) {
    const err = new Error("HTTP " + res.status);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

// "Song hay chet": goi GET /api/health (khong can dang nhap - xem
// HealthController). Dung boi BackendGate.jsx de biet luc nao backend (java
// -jar, do Electron tu spawn khi mo app) da san sang, tranh hien "MAT KET
// NOI" gia lap trong vai giay dau tien luc backend con dang khoi dong.
// Timeout ngan (2.5s) de khong bi "treo" cho neu ket noi bi tu choi kieu cham.
export async function ping(base) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch(joinUrl(base, "/api/health"), {
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
  } finally {
    clearTimeout(timer);
  }
}

export async function login(base, username, password) {
  const res = await fetch(joinUrl(base, "/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = new Error("login");
    err.status = res.status;
    throw err;
  }
  return res.json(); // { token, username, fullName, role, expiresInMinutes }
}

// Client gan san base + token
export function makeClient(base, token) {
  const g = (path) => request(base, path, token);
  const j = (path, method, body) =>
    request(base, path, token, {
      method,
      headers: body != null ? { "Content-Type": "application/json" } : {},
      body: body != null ? JSON.stringify(body) : undefined,
    });
  return {
    // doc (viewer + admin)
    me: () => g("/api/auth/me"),
    teams: () => g("/api/teams"),
    runs: () => g("/api/runs"),
    leaderboard: () => g("/api/leaderboard"),
    liveLatest: () => g("/api/live/latest"),
    runStats: (id) => g(`/api/runs/${id}/stats`),
    runLogs: (id, page = 0, size = 40) => g(`/api/runs/${id}/logs?page=${page}&size=${size}`),
    // ghi (chi admin)
    teamRevoke: (id) => j(`/api/teams/${id}/revoke`, "POST"),
    teamRestore: (id) => j(`/api/teams/${id}/restore`, "POST"),
    teamUpdate: (id, body) => j(`/api/teams/${id}`, "PATCH", body),
    teamCarKey: (id) => j(`/api/teams/${id}/car-api-key`, "POST"),
    runOpen: (teamId, note) => j(`/api/runs`, "POST", { teamId, note: note || null }),
    runCarStart: (id) => j(`/api/runs/${id}/car-start`, "POST"),
    runFinish: (id, result) => j(`/api/runs/${id}/finish`, "POST", { result: result || null }),
    runVoid: (id, note) => j(`/api/runs/${id}/void`, "POST", { note: note || null }),
    audit: (page = 0, size = 12) => g(`/api/audit?page=${page}&size=${size}`),
  };
}
