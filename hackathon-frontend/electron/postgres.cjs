// Postgres "nhung" (embedded) — CHI danh cho demo/dev tren 1 may, KHONG
// danh cho trien khai giai dau that (xem README-DESKTOP.md muc "Postgres
// nhung"). Hoan toan tuy chon: neu khong tim thay thu muc pg-portable/
// (ban Postgres portable cho Windows ban tu tai ve, khong di kem repo),
// module nay khong lam gi ca va Postgres van duoc coi la dich vu da cai
// san tu truoc — dung y het hanh vi cu (main.cjs truoc khi co file nay).
"use strict";

const path = require("path");
const fs = require("fs");
const { spawn, spawnSync } = require("child_process");
const { app } = require("electron");

const isDev = !app.isPackaged;
const PORT = Number(process.env.PITWALL_PG_PORT) || 5433;
const PG_USER = "postgres";

let pgProc = null;
let pgDataDir = null;
let pgBinDir = null;

function resourcesRoot() {
  return isDev ? path.join(__dirname, "..", "..") : process.resourcesPath;
}

// Dev: hackathon-frontend/pg-portable/bin/... — dat ban Postgres portable
// (zip tu EDB, khong phai trinh cai dat) vao day.
// Da dong goi: resources/pg-portable/bin/... (chi co neu ban tu them vao
// package.json#build.extraResources — xem README).
function findPgBinDir() {
  const p = isDev
    ? path.join(resourcesRoot(), "hackathon-frontend", "pg-portable", "bin")
    : path.join(resourcesRoot(), "pg-portable", "bin");
  const marker = process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl";
  return fs.existsSync(path.join(p, marker)) ? p : null;
}

function findBootstrapSql() {
  const p = isDev
    ? path.join(resourcesRoot(), "Car", "init_basic_int.txt")
    : path.join(resourcesRoot(), "db", "init_basic_int.sql");
  return fs.existsSync(p) ? p : null;
}

function bin(name) {
  return path.join(pgBinDir, process.platform === "win32" ? name + ".exe" : name);
}

function isInitialized() {
  return fs.existsSync(path.join(pgDataDir, "PG_VERSION"));
}

function runInitdb() {
  console.log("[pitwall][pg] lan dau chay o may nay — khoi tao data directory:", pgDataDir);
  fs.mkdirSync(pgDataDir, { recursive: true });
  const res = spawnSync(
    bin("initdb"),
    ["-D", pgDataDir, "-U", PG_USER, "--auth=trust", "-E", "UTF8"],
    { stdio: "inherit" }
  );
  if (res.status !== 0) {
    console.error("[pitwall][pg] LOI: initdb that bai, ma thoat:", res.status);
    return false;
  }
  return true;
}

function waitReady(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    (function tick() {
      const res = spawnSync(bin("pg_isready"), ["-p", String(PORT), "-U", PG_USER]);
      if (res.status === 0) return resolve(true);
      if (Date.now() > deadline) return resolve(false);
      setTimeout(tick, 500);
    })();
  });
}

// Chay init_basic_int.txt (tao database/role/bang) — chi 1 lan duy nhat,
// danh dau bang 1 file trong chinh data directory (song cung vong doi voi
// du lieu, khong bi mat khi cap nhat app).
function runBootstrapOnce() {
  const marker = path.join(pgDataDir, ".pitwall-bootstrapped");
  if (fs.existsSync(marker)) return;
  const sql = findBootstrapSql();
  if (!sql) {
    console.warn("[pitwall][pg] khong thay init_basic_int de nap tu dong — tu chay psql -f tay neu can.");
    return;
  }
  console.log("[pitwall][pg] nap schema/role tu:", sql);
  const res = spawnSync(bin("psql"), ["-p", String(PORT), "-U", PG_USER, "-d", "postgres", "-f", sql], { stdio: "inherit" });
  if (res.status === 0) {
    fs.writeFileSync(marker, new Date().toISOString());
  } else {
    console.error(
      "[pitwall][pg] LOI nap schema, ma:", res.status,
      "— neu file da chay 1 lan roi (loi 'already exists') thi bo qua duoc, xoa marker de thu lai."
    );
  }
}

// Goi truoc spawnBackend() trong main.cjs. Tra ve true neu da tu quan ly
// duoc Postgres nhung va no dang san sang tai 127.0.0.1:PORT; false neu
// khong tim thay pg-portable/ (truong hop mac dinh) — main.cjs cu tiep tuc
// coi Postgres la dich vu ngoai, khong doi gi so voi truoc.
async function ensureEmbeddedPostgres() {
  pgBinDir = findPgBinDir();
  if (!pgBinDir) {
    console.log("[pitwall][pg] khong co pg-portable/ — bo qua (mac dinh: Postgres la dich vu Windows da cai san).");
    return false;
  }

  pgDataDir = path.join(app.getPath("userData"), "pgdata");

  if (!isInitialized() && !runInitdb()) return false;

  console.log("[pitwall][pg] khoi dong Postgres nhung, cong", PORT, "- data:", pgDataDir);
  pgProc = spawn(
    bin("postgres"),
    ["-D", pgDataDir, "-p", String(PORT), "-c", "listen_addresses=127.0.0.1"],
    { stdio: "inherit" }
  );
  pgProc.on("error", (e) => console.error("[pitwall][pg] LOI khong chay duoc postgres.exe:", e.message));
  pgProc.on("exit", (code) => { if (code !== 0) console.log("[pitwall][pg] postgres da thoat, ma:", code); });

  const ready = await waitReady(15000);
  if (!ready) {
    console.error("[pitwall][pg] LOI: Postgres khong san sang sau 15s (xem log postgres o tren).");
    return false;
  }
  runBootstrapOnce();
  console.log(
    "[pitwall][pg] san sang tai 127.0.0.1:" + PORT +
    " — nho dat HACKATHON_DB_HOST=127.0.0.1 va HACKATHON_DB_PORT=" + PORT + " trong .env backend."
  );
  return true;
}

function stopEmbeddedPostgres() {
  if (!pgBinDir || !pgDataDir) return;
  console.log("[pitwall][pg] dang dung Postgres nhung...");
  const res = spawnSync(bin("pg_ctl"), ["-D", pgDataDir, "-m", "fast", "stop"]);
  if (res.status !== 0 && pgProc && pgProc.exitCode === null) {
    try { pgProc.kill(); } catch (e) { /* bo qua */ }
  }
}

module.exports = { ensureEmbeddedPostgres, stopEmbeddedPostgres, PORT };
