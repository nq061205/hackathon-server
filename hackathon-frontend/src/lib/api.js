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
    runOpen: (teamId, note) => j(`/api/runs`, "POST", { teamId, note: note || null }),
    runFinish: (id, result) => j(`/api/runs/${id}/finish`, "POST", { result: result || null }),
    runVoid: (id, note) => j(`/api/runs/${id}/void`, "POST", { note: note || null }),
    audit: (page = 0, size = 12) => g(`/api/audit?page=${page}&size=${size}`),
  };
}
