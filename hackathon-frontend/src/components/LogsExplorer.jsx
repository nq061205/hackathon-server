import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import { fmtMs, latClass } from "../lib/format";

const PAGE_SIZES = [50, 200, 500, 1000, 2000];

function parseAi(raw) {
  if (raw == null) return {};
  if (typeof raw === "object") return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

function fmtClock(ms) {
  if (ms == null) return "—";
  const d = new Date(Number(ms));
  if (isNaN(d.getTime())) return "—";
  const hms = d.toLocaleTimeString(undefined, { hour12: false });
  return hms + "." + String(d.getMilliseconds()).padStart(3, "0");
}

// Escape truoc, to mau sau — de gia tri du lieu xe gui ve (khong tin duoc) khong
// the chen the HTML vao trang (XSS) du hien thi qua dangerouslySetInnerHTML.
function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function syntaxHighlight(obj) {
  const escaped = escapeHtml(JSON.stringify(obj, null, 2));
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = "jn";
      if (/^"/.test(match)) cls = /:$/.test(match) ? "jk" : "js";
      else if (/true|false/.test(match)) cls = "jb";
      else if (/null/.test(match)) cls = "jz";
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

function LogRow({ row }) {
  const [open, setOpen] = useState(false);
  const ai = row.aiResult;
  const preview = useMemo(() => {
    const s = JSON.stringify(ai);
    return s.length > 100 ? s.slice(0, 100) + "…" : s;
  }, [ai]);
  const lat = row.latencyMs != null ? Math.round(row.latencyMs) : null;

  return (
    <div className={`logx-row${ai.obstacle ? " has-obs" : ""}`}>
      <div className="logx-row-head" onClick={() => setOpen((v) => !v)}>
        <span className="seq num">#{row.sequenceNo}</span>
        <span className="tm num">{fmtClock(row.carTimestamp)}</span>
        <span className="tm num">{fmtClock(row.receivedAt)}</span>
        <span className={`lat num ${latClass(lat)}`}>{lat != null ? lat + "ms" : "—"}</span>
        <span className="prev">{preview}</span>
        <span className={`chev ${open ? "on" : ""}`}>▸</span>
      </div>
      {open && (
        <div className="logx-row-body">
          <pre dangerouslySetInnerHTML={{ __html: syntaxHighlight(ai) }} />
        </div>
      )}
    </div>
  );
}

export default function LogsExplorer({ data, client, selRun }) {
  const { t } = useI18n();
  const isLive = !!client;
  const runs = data.runs.slice().sort((a, b) => b.id - a.id);
  const teamName = (id) => (data.teams.find((x) => x.id === id) || {}).teamName || ("#" + id);

  const [runId, setRunId] = useState(selRun || (runs[0] && runs[0].id) || null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(200);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fSeqMin, setFSeqMin] = useState("");
  const [fSeqMax, setFSeqMax] = useState("");
  const [fObstacleOnly, setFObstacleOnly] = useState(false);
  const [fSearch, setFSearch] = useState("");

  useEffect(() => { setPage(0); }, [runId]);

  useEffect(() => {
    if (!runId) { setRows([]); setMeta(null); return; }
    if (!isLive) {
      setRows((data.logsByRun[runId] || []).map((it) => ({ ...it, aiResult: parseAi(it.aiResult) })));
      setMeta(null);
      return;
    }
    let alive = true;
    setLoading(true); setErr(null);
    client.runLogs(runId, page, size)
      .then((res) => {
        if (!alive) return;
        setRows((res.content || []).map((it) => ({ ...it, aiResult: parseAi(it.aiResult) })));
        setMeta({ totalElements: res.totalElements, totalPages: res.totalPages });
      })
      .catch((e) => { if (alive) setErr(e && e.message ? e.message : String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, page, size, isLive, reloadTick]);

  const filtered = useMemo(() => {
    const fromMs = fFrom ? new Date(fFrom).getTime() : null;
    const toMs = fTo ? new Date(fTo).getTime() : null;
    const seqMin = fSeqMin !== "" ? Number(fSeqMin) : null;
    const seqMax = fSeqMax !== "" ? Number(fSeqMax) : null;
    const needle = fSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (fromMs != null && r.receivedAt < fromMs) return false;
      if (toMs != null && r.receivedAt > toMs) return false;
      if (seqMin != null && r.sequenceNo < seqMin) return false;
      if (seqMax != null && r.sequenceNo > seqMax) return false;
      if (fObstacleOnly && !r.aiResult.obstacle) return false;
      if (needle && !JSON.stringify(r.aiResult).toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, fFrom, fTo, fSeqMin, fSeqMax, fObstacleOnly, fSearch]);

  function clearFilters() {
    setFFrom(""); setFTo(""); setFSeqMin(""); setFSeqMax(""); setFObstacleOnly(false); setFSearch("");
  }

  const run = runs.find((r) => r.id === runId);

  return (
    <div className="panel logx-panel">
      <div className="head">
        <div className="title">{t("logs.title")}<small>{t("logs.hint")}</small></div>
        <span className="spacer" />
        {isLive && <button className="btn sm" onClick={() => setReloadTick((n) => n + 1)}>{t("logs.refresh")}</button>}
      </div>

      {!isLive && <div className="logx-demo-note">{t("logs.demoNote")}</div>}

      <div className="logx-toolbar">
        <div className="logx-field">
          <label>{t("logs.pickRun")}</label>
          <select value={runId ?? ""} onChange={(e) => setRunId(Number(e.target.value) || null)}>
            {runs.length === 0 && <option value="">{t("logs.noRuns")}</option>}
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                #{r.id} · {teamName(r.teamId)} · {t("admin.heat")} {r.heatNo} · {r.status}
              </option>
            ))}
          </select>
        </div>

        {isLive && (
          <div className="logx-field">
            <label>{t("logs.pageSize")}</label>
            <select value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}>
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        <div className="logx-field">
          <label>{t("logs.from")}</label>
          <input type="datetime-local" step="1" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
        </div>
        <div className="logx-field">
          <label>{t("logs.to")}</label>
          <input type="datetime-local" step="1" value={fTo} onChange={(e) => setFTo(e.target.value)} />
        </div>
        <div className="logx-field">
          <label>{t("logs.seqFrom")}</label>
          <input type="number" value={fSeqMin} onChange={(e) => setFSeqMin(e.target.value)} style={{ width: 90 }} />
        </div>
        <div className="logx-field">
          <label>{t("logs.seqTo")}</label>
          <input type="number" value={fSeqMax} onChange={(e) => setFSeqMax(e.target.value)} style={{ width: 90 }} />
        </div>
        <div className="logx-field">
          <label>{t("logs.search")}</label>
          <input type="text" value={fSearch} onChange={(e) => setFSearch(e.target.value)} placeholder={t("logs.search")} style={{ width: 180 }} />
        </div>
        <label className="logx-check">
          <input type="checkbox" checked={fObstacleOnly} onChange={(e) => setFObstacleOnly(e.target.checked)} />
          {t("logs.obstacleOnly")}
        </label>
        <button className="btn sm ghost" onClick={clearFilters}>{t("logs.clear")}</button>
      </div>

      <div className="logx-meta">
        <span>
          {t("logs.shown")} <b className="num">{filtered.length}</b> {t("logs.of")} <b className="num">{rows.length}</b> {t("logs.rows")}
          {meta && <> · <b className="num">{meta.totalElements.toLocaleString()}</b> {t("logs.total")}</>}
        </span>
        {isLive && meta && (
          <div className="logx-pager">
            <button className="btn sm" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>{t("logs.prev")}</button>
            <span className="num">{t("logs.page")} {page + 1}/{Math.max(1, meta.totalPages)}</span>
            <button className="btn sm" disabled={page + 1 >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>{t("logs.next")}</button>
          </div>
        )}
      </div>

      {loading && <div className="logx-empty">{t("logs.loading")}</div>}
      {err && <div className="logx-empty" style={{ color: "var(--danger)" }}>{t("logs.errorPrefix")}{err}</div>}
      {!loading && !err && !runId && <div className="logx-empty">{t("logs.noRun")}</div>}
      {!loading && !err && runId && filtered.length === 0 && <div className="logx-empty">{t("logs.empty")}</div>}

      {!loading && !err && filtered.length > 0 && (
        <div className="logx-list">
          <div className="logx-row-head logx-col-head">
            <span>Seq</span>
            <span>{t("logs.carTime")}</span>
            <span>{t("logs.serverTime")}</span>
            <span>{t("logs.latency")}</span>
            <span>JSON</span>
            <span />
          </div>
          {filtered.map((r) => <LogRow key={r.sequenceNo} row={r} />)}
        </div>
      )}
    </div>
  );
}
