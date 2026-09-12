#!/usr/bin/env node
// Chay truoc khi mo/dong goi app desktop (xem tauri.conf.json#build).
// Chi lam MOT viec: dam bao backend-1.0.0.jar da ton tai truoc khi Tauri can
// den no (src-tauri/src/main.rs tu tim jar de chay ngam luc mo app, va
// tauri.conf.json#bundle.resources can no de dong vao bo cai).
//
// Khong dung file, khong dong goi lai neu jar da co san va pom.xml khong doi
// moi hon no — de vong dev lap lai nhanh, khong phai `mvn package` moi lan.

import { spawnSync } from "node:child_process";
import { existsSync, statSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const backendDir = join(here, "..", "..", "hackathon-backend");
const pom = join(backendDir, "pom.xml");
const srcDir = join(backendDir, "src");
const jar = join(backendDir, "target", "backend-1.0.0.jar");

// Tim mtime moi nhat trong toan bo src/ (khong chi pom.xml) — truoc day chi
// so sanh pom.xml nen sua .java (vd config CORS) khong lam jar cu bi coi la
// "loi thoi", app cu chay mai voi code cu du da sua source.
function newestMtime(path) {
  const st = statSync(path);
  if (st.isFile()) return st.mtimeMs;
  let max = st.mtimeMs;
  for (const entry of readdirSync(path)) {
    max = Math.max(max, newestMtime(join(path, entry)));
  }
  return max;
}

if (!existsSync(pom)) {
  console.warn("[prebuild] khong thay hackathon-backend/pom.xml — bo qua buoc build backend.");
  process.exit(0);
}

const newestSourceMtime = Math.max(
  statSync(pom).mtimeMs,
  existsSync(srcDir) ? newestMtime(srcDir) : 0
);

if (existsSync(jar) && statSync(jar).mtimeMs > newestSourceMtime) {
  console.log("[prebuild] backend-1.0.0.jar da co san va moi hon toan bo src/+pom.xml, bo qua `mvn package`.");
  process.exit(0);
}

console.log("[prebuild] dang chay `mvn clean package -DskipTests` trong hackathon-backend ...");
const res = spawnSync("mvn", ["-q", "clean", "package", "-DskipTests"], {
  cwd: backendDir,
  stdio: "inherit",
  shell: true, // can tren Windows de tim mvn.cmd
});

if (res.status !== 0) {
  console.error(
    "[prebuild] `mvn package` that bai (hoac chua cai Maven/Java 21+ trong PATH). " +
    "App desktop van mo duoc nhung phan backend se khong tu chay — xem README-DESKTOP.md."
  );
  // Khong chan het build frontend chi vi backend loi — thoat 0 de tauri:dev/build tiep tuc.
  process.exit(0);
}

console.log("[prebuild] xong — backend-1.0.0.jar san sang.");
