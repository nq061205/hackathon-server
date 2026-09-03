import { useState, useCallback } from "react";
import { login as apiLogin } from "../lib/api";

// Phien dang nhap. Luu vao localStorage de tai lai trang van giu phien (nhu web binh thuong).
// Dang xuat xoa phien. Token luu client-side (chap nhan duoc voi cong cu noi bo cua giam khao).
const KEY = "pw_session";

function load() {
  try {
    const s = localStorage.getItem(KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}
function save(s) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

export function useAuth() {
  const [session, setSession] = useState(load);

  const loginLive = useCallback(async (api, user, pass) => {
    const r = await apiLogin(api, user, pass);
    const s = { mode: "live", api, token: r.token, user: r.username, role: r.role, fullName: r.fullName };
    setSession(s); save(s);
    return s;
  }, []);

  const logout = useCallback(() => {
    setSession(null); save(null);
  }, []);

  return { session, loginLive, logout };
}
