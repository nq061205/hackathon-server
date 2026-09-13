// Ket noi WebSocket (STOMP qua SockJS) toi backend de nhan du lieu day dong
// bo — xem hooks/useRaceData.js. Dung chung 1 ket noi cho ca du lieu dua xe
// (/topic/race-data) va audit log (/topic/admin/audit, chi admin) trong
// cung 1 cua so (chinh hoac 1 cua so da "tach ra" — moi BrowserWindow la 1
// tien trinh renderer doc lap nen tu mo ket noi rieng cua no).
//
// Token truyen qua query param ?token=... (khong dung header Authorization
// nhu REST duoc, vi WebSocket API cua trinh duyet khong cho gan header tuy y
// luc mo ket noi) — backend kiem tra token nay trong JwtHandshakeInterceptor.

import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

export function createRaceSocket(api, token) {
  const base = (api || "").replace(/\/$/, "");
  return new Client({
    webSocketFactory: () => new SockJS(`${base}/ws?token=${encodeURIComponent(token)}`),
    reconnectDelay: 2000, // mat mang giua chung -> tu ket noi lai, khong can nguoi dung lam gi
  });
}
