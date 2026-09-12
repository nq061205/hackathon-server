// Pit Wall Console — vo desktop (Electron) cho hackathon-frontend (Vite/React).
//
// Khong sua giao dien: cua so chinh chi tai lai dung trang React (dev: Vite
// dev server tren :3010; ban da dong goi: dist/index.html). Them 2 viec:
//   1) Mo app -> tu chay ngam backend (java -jar) + ingest_server.py
//      (python); dong cua so chinh -> tu tat ca hai. Postgres KHONG duoc
//      quan ly o day (coi nhu dich vu Windows chay san truoc gio thi dau).
//   2) "Tach cua so" (mo mot nguon trong bo chuyen canh thanh cua so rieng)
//      qua IPC — xem preload.cjs + src/lib/desktop.js.
"use strict";

const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { ensureEmbeddedPostgres, stopEmbeddedPostgres } = require("./postgres.cjs");

const isDev = !app.isPackaged;
let mainWindow = null;
let backendProc = null;
let ingestProc = null;

// San xuat (da dong goi): electron-builder copy extraResources vao day
// (xem package.json#build.extraResources). Phat trien: chay thang tu
// source, tro ve goc monorepo (hackathon-server) tu hackathon-frontend/electron.
function resourcesRoot() {
  return isDev ? path.join(__dirname, "..", "..") : process.resourcesPath;
}

function findBackendJar() {
  const p = isDev
    ? path.join(resourcesRoot(), "hackathon-backend", "target", "backend-1.0.0.jar")
    : path.join(resourcesRoot(), "backend", "backend-1.0.0.jar");
  return fs.existsSync(p) ? p : null;
}

function findIngestScript() {
  const p = isDev
    ? path.join(resourcesRoot(), "Car", "simulator", "ingest_server.py")
    : path.join(resourcesRoot(), "ingest", "ingest_server.py");
  return fs.existsSync(p) ? p : null;
}

function spawnBackend() {
  const jar = findBackendJar();
  if (!jar) {
    console.error(
      "[pitwall] LOI: khong tim thay backend-1.0.0.jar. " +
      "Chay `mvn clean package` trong hackathon-backend truoc (che do phat trien), " +
      "hoac kiem tra buoc dong goi resources (ban da cai)."
    );
    return;
  }
  console.log("[pitwall] khoi dong backend:", jar);
  backendProc = spawn("java", ["-jar", jar], { cwd: path.dirname(jar), stdio: "inherit", windowsHide: true });
  backendProc.on("error", (e) =>
    console.error("[pitwall] LOI khong chay duoc backend (Java 21+ co trong PATH khong?):", e.message)
  );
  backendProc.on("exit", (code) => console.log("[pitwall] backend da thoat, ma:", code));
}

function spawnIngest() {
  const script = findIngestScript();
  if (!script) {
    console.error("[pitwall] LOI: khong tim thay ingest_server.py.");
    return;
  }
  console.log("[pitwall] khoi dong ingest:", script);
  ingestProc = spawn("python", [script], { cwd: path.dirname(script), stdio: "inherit", windowsHide: true });
  ingestProc.on("error", (e) =>
    console.error("[pitwall] LOI khong chay duoc ingest (Python co trong PATH khong, da pip install requirements.txt chua?):", e.message)
  );
  ingestProc.on("exit", (code) => console.log("[pitwall] ingest da thoat, ma:", code));
}

function killChild(name, proc) {
  if (proc && proc.exitCode === null && !proc.killed) {
    console.log("[pitwall] dang dung", name);
    try { proc.kill(); } catch (e) { console.error("[pitwall] khong dung duoc", name, e.message); }
  }
}

function windowIcon() {
  const p = path.join(__dirname, "..", "build", "icon.ico");
  return fs.existsSync(p) ? p : undefined;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 1024,
    minHeight: 680,
    title: "Pit Wall Console",
    icon: windowIcon(),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // Ban release: khoa DevTools (F12 / Ctrl+Shift+I khong mo duoc nua).
      // Che do dev van bat de con debug.
      devTools: isDev,
    },
  });

  if (isDev) mainWindow.loadURL("http://localhost:3010");
  else mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));

  mainWindow.on("closed", () => { mainWindow = null; });
}

// Cua so cho mot nguon da "tach ra" (xem src/lib/desktop.js#openPopout va
// src/components/Switcher.jsx). Tai lai dung app nay voi ?popout=<id> —
// src/App.jsx nhan dien va render PopoutView.jsx thay vi Dashboard.
function createPopoutWindow(sourceId) {
  const win = new BrowserWindow({
    width: 900,
    height: 620,
    minWidth: 420,
    minHeight: 300,
    title: "Pit Wall — " + sourceId,
    icon: windowIcon(),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // Ban release: khoa DevTools (F12 / Ctrl+Shift+I khong mo duoc nua).
      // Che do dev van bat de con debug.
      devTools: isDev,
    },
  });
  const search = "popout=" + encodeURIComponent(sourceId);
  if (isDev) win.loadURL(`http://localhost:3010/?${search}`);
  else win.loadFile(path.join(__dirname, "..", "dist", "index.html"), { search });
  return win;
}

ipcMain.handle("pitwall:openPopout", (_event, sourceId) => {
  createPopoutWindow(String(sourceId || "log"));
  return true;
});

ipcMain.on("pitwall:closeThisWindow", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

// "Gop lai" (nguoc voi Tach cua so): dua cua so chinh len truoc (show + focus
// — phong truong hop no dang bi thu nho/khuat sau cua so khac), roi dong
// dung cua so popout vua bam nut. Khong "di chuyen" gi ve mat noi dung — cua
// so chinh van luon hien thi day du, popout tu dau chi la 1 ban xem them
// (mirror) cua dung nguon dang on-air, nen "gop lai" == dong popout + quay
// ve nhin cua so chinh.
ipcMain.on("pitwall:mergeBack", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }
  if (win && win !== mainWindow) win.close();
});

app.whenReady().then(async () => {
  // Chi co tac dung neu ban tu them thu muc pg-portable/ (demo/dev tren 1
  // may) — xem electron/postgres.cjs va README-DESKTOP.md. Mac dinh (khong
  // co thu muc do) ham nay tra ve ngay, Postgres van la dich vu Windows da
  // cai san tu truoc, dung y het truoc gio.
  await ensureEmbeddedPostgres();
  // An thanh menu mac dinh cua Electron (File/Edit/View/... va muc Toggle
  // Developer Tools nam trong do) — CHI o ban dong goi. Che do dev van giu
  // menu + DevTools de con debug.
  if (!isDev) Menu.setApplicationMenu(null);
  spawnBackend();
  spawnIngest();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  killChild("backend", backendProc);
  killChild("ingest", ingestProc);
  stopEmbeddedPostgres();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  killChild("backend", backendProc);
  killChild("ingest", ingestProc);
  stopEmbeddedPostgres();
});
