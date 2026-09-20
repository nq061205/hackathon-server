// Cau noi an toan giua giao dien (renderer, khong co quyen Node/OS truc tiep
// vi contextIsolation:true + nodeIntegration:false trong main.js) va tien
// trinh chinh Electron. Chi lo dung 3 viec bo chuyen canh can:
//   - openPopout(sourceId): mo mot nguon thanh cua so rieng.
//   - closeThisWindow(): dong cua so hien tai (dung trong PopoutView.jsx).
//   - mergeBack(): dong cua so popout VA dua cua so chinh len truoc (nguoc
//     voi openPopout — xem main.cjs#pitwall:mergeBack).
"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isDesktop: true,
  openPopout: (sourceId) => ipcRenderer.invoke("pitwall:openPopout", sourceId),
  closeThisWindow: () => ipcRenderer.send("pitwall:closeThisWindow"),
  mergeBack: () => ipcRenderer.send("pitwall:mergeBack"),
});
