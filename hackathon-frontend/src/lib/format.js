export function fmtMs(ms) {
  if (ms == null) return "—";
  return ms >= 1000 ? (ms / 1000).toFixed(2) + "s" : Math.round(ms) + "ms";
}

// Phan loai do tre de to mau: ok (<=30ms), mid (<=80ms), hi (>80ms)
export function latClass(v) {
  if (v == null) return "";
  return v <= 30 ? "ok" : v <= 80 ? "mid" : "hi";
}

export function fmtInt(n) {
  return (n ?? 0).toLocaleString();
}

// ---- Diễn giải "dễ hiểu" cho giám khảo (không cần biết ms/gói) ----
// Chất lượng tín hiệu suy từ độ trễ trung bình.
export function signalKey(latMs) {
  if (latMs == null) return "none";
  return latMs <= 30 ? "good" : latMs <= 80 ? "fair" : "weak";
}
// Độ ổn định kết nối suy từ số gói mất.
export function connKey(lost) {
  return (lost || 0) > 0 ? "unstable" : "stable";
}

// Màu nhận diện từng đội — dùng chung cho Timing Tower, Live Timing, bản đồ.
export const TEAM_COLORS = [
  "#e10600", "#38bdf8", "#22c55e", "#eab308", "#a855f7",
  "#fb7185", "#14b8a6", "#f97316", "#8b5cf6", "#facc15",
  "#06b6d4", "#84cc16", "#ec4899", "#f43f5e", "#0ea5e9",
];
export const teamColor = (id) => TEAM_COLORS[(Number(id) || 0) % TEAM_COLORS.length];

