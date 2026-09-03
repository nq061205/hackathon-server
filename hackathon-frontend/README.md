# Pit Wall — Frontend giám khảo (React + Vite)

Giao diện **pixel/arcade** cho ban giám khảo theo dõi log xe thi đấu theo thời gian thực.
Nối vào backend Spring Boot qua tài khoản **viewer** (WPA2-Enterprise / RADIUS project).

## Chạy

```bash
cd hackathon-frontend
npm install
npm run dev        # mở http://localhost:5173
```

**Cấu hình trong `.env`** (không hardcode trong code):

- `VITE_DEFAULT_API` — địa chỉ API điền sẵn ở màn hình đăng nhập (mặc định `http://localhost:8080`).
- `VITE_API_TARGET` — backend cho dev proxy: mọi request `/api/*` được chuyển sang đây, tránh CORS khi chạy dev.

Đổi `.env` rồi chạy lại `npm run dev`. Nếu backend ở máy khác, đặt cả hai thành IP máy đó,
ví dụ `http://192.168.0.101:8080`.

Font pixel dùng **Handjet** (có hỗ trợ tiếng Việt) cho tiêu đề và **VT323** cho dữ liệu —
tải từ Google Fonts, có fallback monospace nếu offline.

Build production:

```bash
npm run build      # ra thư mục dist/
npm run preview    # xem thử bản build
```

## Đăng nhập / Đăng xuất

- Màn hình **đăng nhập** yêu cầu địa chỉ API + tài khoản + mật khẩu (gọi `POST /api/auth/login`).
  Đăng nhập thành công lưu phiên vào `localStorage` → tải lại trang vẫn giữ đăng nhập (như web thường).
- Nút **Đăng xuất** ở góc phải trên xoá phiên, quay lại màn hình đăng nhập.
- Nếu token hết hạn (backend trả 401), app tự đăng xuất.
- Nút **Xem thử (Demo)**: vào thẳng bảng theo dõi với dữ liệu giả lập, không cần backend
  (tiện demo giao diện; dữ liệu do `lib/demoEngine.js` sinh).

## Cấu trúc

```
src/
  main.jsx                 điểm vào, bọc I18nProvider + theme.css
  App.jsx                  chọn LoginScreen hoặc Dashboard theo phiên
  styles/theme.css         toàn bộ giao diện pixel/arcade (1 theme tối, có lớp CRT)
  i18n/                    strings.js (vi+en) + I18nContext.jsx (useI18n)
  lib/
    api.js                 lớp gọi backend (login, teams, runs, leaderboard, stats, logs)
    demoEngine.js          bộ sinh dữ liệu demo
    sprites.jsx            icon pixel (cờ, xe, cúp, đèn, sóng, user) vẽ bằng <rect>
    format.js              fmtMs / latClass / fmtInt
  hooks/
    useAuth.js             phiên đăng nhập (login/logout/demo, nhớ localStorage)
    useRaceData.js         vòng poll demo/live -> { data, online, selRun, setSelRun }
  components/
    LoginScreen.jsx  TopBar.jsx  StartLights.jsx
    LaneGrid.jsx     LiveLog.jsx  Leaderboard.jsx  Dashboard.jsx
```

## Backend endpoints được dùng (đều quyền viewer)

`POST /api/auth/login` · `GET /api/teams` · `GET /api/runs` · `GET /api/leaderboard`
· `GET /api/runs/{id}/stats` · `GET /api/runs/{id}/logs?page&size`

## Ghi chú

- Chỉ một theme tối (arcade) — cố ý, đã tô nền + màu tường minh nên hiển thị ổn ở mọi nền.
- Tôn trọng `prefers-reduced-motion` (tắt quét CRT + hiệu ứng flash).
- Font pixel (`Press Start 2P`, `VT323`) tải từ Google Fonts; có fallback monospace nếu offline.
