import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { STRINGS } from "./strings";

const I18nCtx = createContext(null);

function readLang() {
  try { return localStorage.getItem("pw_lang") === "en" ? "en" : "vi"; } catch { return "vi"; }
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(readLang);

  const t = useCallback((key) => (STRINGS[lang][key] ?? key), [lang]);

  const toggle = useCallback(() => {
    setLang((prev) => {
      const next = prev === "vi" ? "en" : "vi";
      try { localStorage.setItem("pw_lang", next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ lang, t, toggle }), [lang, t, toggle]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
