# Pit Wall Console — bản desktop (Electron)

Bọc nguyên `hackathon-frontend` (React/Vite) hiện có thành một chương trình
Windows thật — giao diện y hệt bản web, thêm ba thứ:

1. **Bộ chuyển cảnh (tab "Bộ chuyển cảnh" / Switcher)** kiểu vMix/TriCaster:
   lưới các "nguồn" (bản đồ đường đua, Live Timing, bảng xếp hạng, log, mạng,
   race control, sự cố, xác suất thắng) — mỗi ô là chính component đã có,
   thu nhỏ lại nhưng vẫn sống. Bấm một ô = chọn **xem trước** (viền xanh),
   bấm **CHUYỂN LÊN SÓNG** (hoặc bấm đúp vào ô) = đẩy lên **phát sóng**
   (viền đỏ, hiện to ở khối trên).
2. **Tách cửa sổ**: nút "⇱ Tách cửa sổ" ở khối phát sóng mở đúng nguồn đang
   lên sóng thành một cửa sổ Windows riêng — kéo nó sang màn hình phụ /
   máy chiếu. Cửa sổ mới dùng lại phiên đăng nhập hiện có (không cần đăng
   nhập lại) và tự cập nhật dữ liệu độc lập.
3. **Một lệnh / một icon là chạy hết**: mở app này sẽ **tự động khởi động
   ngầm** cả `backend` (Java) lẫn `ingest_server.py` (Python), và **tự tắt cả
   hai** khi đóng cửa sổ chính. Không cần mở 2–3 terminal riêng nữa.

**Không đụng gì tới code của `hackathon-backend` hay `Car/simulator`** — bản
desktop chỉ thêm một lớp vỏ Electron biết *khởi động hộ* hai tiến trình đó,
vẫn gọi `/api/*` y như cũ.

> Bản trước dùng Tauri (cần cài thêm Rust) — đã đổi sang **Electron** vì chỉ
> cần Node.js bạn đã có sẵn cho Vite, không cần cài compiler nào thêm. Thư
> mục `src-tauri/` cũ không còn dùng nữa, có thể xoá nếu muốn (không ảnh
> hưởng gì nếu để lại).

## Postgres — mặc định KHÔNG nằm trong app này

Postgres cần **cài sẵn và chạy như một dịch vụ Windows từ trước** (giống
vMix cần driver card capture đã cắm sẵn trước khi mở phần mềm). Mặc định app
desktop không kiểm tra, không khởi động, không nhúng Postgres. Hãy chắc chắn
Postgres đang chạy (và đã nạp `init_basic_int.txt`) **trước** khi mở Pit Wall
Console.

**Đây là cách nên dùng cho giải đấu thật** — vì FreeRADIUS (chạy trên máy
Ubuntu riêng, xem `RADIUS-SQL-Runbook.txt`) tra cứu thẳng vào Postgres qua
mạng LAN, độc lập với việc app desktop này có đang mở hay không. Nếu Postgres
chỉ sống bên trong app desktop, tắt app giữa giải là RADIUS chết theo.

### Postgres nhúng — chỉ dành cho demo/dev trên 1 máy

Nếu chỉ cần bật 1 lệnh là có đủ cả DB để test/demo trên đúng một laptop
(không có FreeRADIUS, không có máy khác cần nối tới DB), có thể để app tự
quản lý một bản Postgres "portable" (không cần trình cài đặt):

1. Tải bản zip Postgres cho Windows (không phải installer) từ
   [EDB — Windows binaries](https://www.enterprisedb.com/download-postgresql-binaries),
   giải nén, rồi copy nguyên thư mục `pgsql` đó thành:
   ```
   hackathon-frontend/pg-portable/
   ```
   sao cho có `hackathon-frontend/pg-portable/bin/postgres.exe` v.v.
2. Chạy `npm run electron:dev` như bình thường. `electron/postgres.cjs` sẽ
   tự phát hiện thư mục này và:
   - Lần đầu: tự `initdb` (data lưu ở
     `%APPDATA%\pitwall-console\pgdata`, **không** nằm trong thư mục cài đặt
     nên không mất khi build lại/cài đè), tự nạp `Car/init_basic_int.txt`.
   - Các lần sau: chỉ khởi động lại, dữ liệu cũ giữ nguyên.
   - Đóng app: tự `pg_ctl stop`.
   - Mặc định chạy ở cổng **5433** (tránh đụng cổng 5432 nếu máy bạn lỡ có
     cài Postgres khác) — đặt `HACKATHON_DB_HOST=127.0.0.1` và
     `HACKATHON_DB_PORT=5433` trong `hackathon-backend/.env`. Đổi cổng bằng
     biến môi trường `PITWALL_PG_PORT` nếu cần.
3. Nếu **không** có thư mục `pg-portable/`, mọi thứ hoạt động y hệt như
   trước (Postgres coi là dịch vụ ngoài) — tính năng này hoàn toàn tuỳ chọn,
   không ảnh hưởng gì tới cách chạy hiện tại.

Muốn Postgres nhúng này có mặt luôn trong bản cài đặt `.exe`
(`npm run electron:build`) chứ không chỉ khi chạy `electron:dev`: sau khi đã
có `pg-portable/` như trên, tự thêm 2 dòng vào mảng
`build.extraResources` trong `package.json`:
```json
{ "from": "pg-portable", "to": "pg-portable" },
{ "from": "../Car/init_basic_int.txt", "to": "db/init_basic_int.sql" }
```
Chưa thêm sẵn vào `package.json` mặc định vì bản cài đặt cho giải đấu thật
không nên mang theo Postgres (xem lý do ở trên) — thêm tay khi thực sự cần
bản demo đóng gói.

## Cài đặt (một lần, trên máy sẽ chạy chương trình)

Chỉ cần thêm so với hiện tại:

```bash
cd hackathon-frontend
npm install
```

(sẽ tải thêm `electron` + `electron-builder`, ~150–250MB vì Electron đóng gói
sẵn Chromium — không cần cài Rust, không cần Visual C++ Build Tools, không
cần WebView2, chỉ dùng Node.js đã có.)

Vẫn cần như quy trình cũ: **Java 21+ và Maven** trong PATH (build & tự chạy
backend), **Python** trong PATH đã `pip install -r Car/simulator/requirements.txt`
(tự chạy ingest server). `hackathon-backend/.env` khai báo như cũ (backend tự
đọc khi được app desktop chạy hộ). `ingest_server.py` vẫn đọc cấu hình qua
biến môi trường hệ điều hành như hiện tại — app desktop không đổi gì ở đây.

## Chạy khi phát triển (từ terminal)

```bash
npm run electron:dev
```

Lệnh này: (1) tự chạy `mvn clean package` cho backend nếu jar chưa có/đã cũ
hơn `pom.xml`, (2) khởi động Vite dev server (cổng 3010), (3) đợi Vite sẵn
sàng rồi mở cửa sổ chương trình — và ngay khi cửa sổ mở, **tự chạy ngầm**
`java -jar hackathon-backend/target/backend-1.0.0.jar` và
`python Car/simulator/ingest_server.py`. Log của cả hai in thẳng ra terminal
này (tìm dòng bắt đầu bằng `[pitwall]`) — nếu Java hoặc Python không có
trong PATH, hoặc backend chưa build được, bạn sẽ thấy dòng `[pitwall] LOI: ...`
giải thích rõ thiếu gì, app vẫn mở bình thường (chỉ riêng dịch vụ đó không
chạy được).

## Đóng gói thành .exe có icon (chạy bằng icon)

```bash
npm run electron:build
```

Ra file cài đặt NSIS trong `release/` (ví dụ `Pit Wall Console Setup 1.0.0.exe`).
Cài xong sẽ có icon "Pit Wall Console" trong Start Menu / Desktop —
double-click chạy thẳng, tự khởi động backend + ingest ngầm, không cần mở
terminal nào.

**Bản cài đặt mang theo** `backend-1.0.0.jar` (build tự động bởi
`npm run electron:build`) và `ingest_server.py` + `config.py` + `protocol.py`,
nằm trong thư mục cài đặt ở `resources\backend\` và `resources\ingest\`.

⚠️ **File `.env` của backend KHÔNG được tự đóng gói vào bộ cài** (cố ý — để
tránh phát tán mật khẩu DB/JWT secret cho bất kỳ ai nhận bộ cài). Sau khi cài
đặt, bạn cần tự đặt một file `.env` (nội dung giống `hackathon-backend/.env`
bạn đang dùng) vào đúng:

```
<thư mục cài đặt Pit Wall Console>\resources\backend\.env
```

Nếu thiếu file này, backend chạy ngầm sẽ báo lỗi thiếu cấu hình DB — dùng
`npm run electron:dev` trước (không phải bản đã cài) để xem log lỗi cụ thể
nếu backend không tự chạy được.

⚠️ Vì bộ cài chưa được ký số (code signing tốn phí/thời gian, không cần cho
demo nội bộ), Windows SmartScreen có thể hiện cảnh báo "Windows protected
your PC" khi chạy file cài đặt lần đầu — đây là bình thường với app tự build
chưa ký, bấm **"More info" → "Run anyway"** để tiếp tục.

Muốn đổi icon riêng: thay `build/icon.ico` (icon Windows chuẩn, có thể tạo
từ ảnh vuông ≥256×256 bằng công cụ chuyển đổi online) rồi build lại.

## Vì sao đổi từ Tauri sang Electron?

Bản đầu dùng Tauri vì file cài đặt nhỏ hơn (~5–10MB) và không cần đóng gói
Chromium riêng, nhưng đòi hỏi cài thêm Rust + Visual C++ Build Tools trên máy
build — bạn báo lỗi thiếu `cargo` khi chạy thử. Electron chỉ cần Node.js đã
có sẵn cho Vite, đổi lại là bộ cài nặng hơn (Chromium đóng gói theo, thường
80–120MB sau khi cài) — với một app nội bộ dùng trong một buổi thi đấu,
đánh đổi này hợp lý hơn để tránh vướng bước cài môi trường build.

## Các file mới/sửa

- `src/lib/sources.js` — danh mục nguồn cho bộ chuyển cảnh.
- `src/lib/desktop.js` — helper phát hiện đang chạy trong Electron + mở cửa sổ tách riêng (qua `window.electronAPI`).
- `src/components/Switcher.jsx` — giao diện bộ chuyển cảnh (tab mới).
- `src/components/PopoutView.jsx` — nội dung cửa sổ đã tách ra.
- `src/App.jsx` — nhận diện URL `?popout=<nguồn>` để render `PopoutView`.
- `src/components/Dashboard.jsx`, `Sidebar.jsx`, `src/i18n/strings.js`, `src/styles/theme.css` — thêm tab "Bộ chuyển cảnh" (không đổi các tab cũ).
- `package.json` — script `electron:dev`, `electron:build`; cấu hình đóng gói `electron-builder` (mục `"build"`).
- `scripts/prebuild.mjs` — tự `mvn clean package` cho backend nếu cần, trước khi mở/đóng gói app.
- `electron/main.cjs` — tiến trình chính Electron: mở app → (tuỳ chọn) tự khởi động Postgres nhúng → tự chạy `java -jar` + `python ingest_server.py`; đóng cửa sổ chính → tự tắt cả ba; tạo cửa sổ "tách riêng" khi được yêu cầu.
- `electron/preload.cjs` — cầu nối an toàn expose `window.electronAPI` cho giao diện (không bật `nodeIntegration`).
- `electron/postgres.cjs` — quản lý Postgres nhúng, **hoàn toàn tuỳ chọn** (chỉ hoạt động nếu có `pg-portable/`, xem mục "Postgres nhúng" ở trên); mặc định không làm gì.
- `build/icon.ico` — icon dùng khi đóng gói.
- `src-tauri/` — **không còn dùng**, còn lại từ bản Tauri trước, có thể xoá.

Chạy `npm run dev` như cũ (không qua Electron) vẫn hoạt động bình thường
trong trình duyệt — nút "Tách cửa sổ" chỉ bị vô hiệu (có ghi chú) và
backend/ingest sẽ không tự chạy hộ, giống quy trình cũ (tự mở riêng).

## Mình đã kiểm chứng gì, và chưa kiểm chứng được gì

Đã làm: kiểm tra cú pháp `electron/main.cjs` và `electron/preload.cjs` bằng
`node --check` (không lỗi), kiểm tra `package.json` là JSON hợp lệ.

Chưa làm được (môi trường mình không có Windows/Java/Postgres thật, cũng
không mở được cửa sổ đồ hoạ để thử): chưa chạy thực tế `npm run electron:dev`
hay `npm run electron:build` trên máy bạn. Khả năng cao nhất nếu có lỗi lần
đầu: đường dẫn `java`/`python`/`mvn` trên máy bạn khác PATH mặc định, hoặc
`electron-builder` cần tải thêm gói phụ trợ lúc build lần đầu (cần mạng).
Gửi lại log lỗi (nếu có) là mình sửa tiếp được ngay.
