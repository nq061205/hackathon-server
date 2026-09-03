# Backend quản trị cuộc thi đua xe + tích hợp RADIUS

Backend Spring Boot cho hệ thống cuộc thi đua xe. Bảng `teams` vừa là danh sách đội,
vừa là **nguồn tài khoản WiFi cho FreeRADIUS** (WPA2-Enterprise). Backend này lo phần
**quản trị** (đăng nhập người dùng, cấp/thu hồi quyền WiFi của từng đội, xem kết quả/thống kê),
còn phần **nhận log UDP giữ nguyên bằng Python** (`Car/simulator/ingest_server.py`) — hai bên
cùng đọc/ghi một database Postgres.

> Database **không** do backend tạo. Toàn bộ schema đến từ `init_basic.sql` bạn đã chạy sẵn.
> Cấu hình JPA để `ddl-auto=none` — Hibernate chỉ ánh xạ vào bảng có sẵn, **không bao giờ sửa schema**.

---

## 1. Kiến trúc đáng chú ý

**Hai kết nối DB theo role (đúng ghi chú #7 trong file SQL).**
File SQL nhấn mạnh: người role `viewer` phải dùng kết nối `app_viewer`, không dùng `app_admin`,
nếu không phân quyền ở tầng database mất tác dụng. Backend hiện thực đúng điều này bằng một
`RoutingDataSource` (Spring `AbstractRoutingDataSource`):

- Đăng nhập / thao tác của **admin** → kết nối `app_admin` (đủ quyền INSERT/UPDATE/DELETE + ghi `audit_log`).
- Thao tác đọc của **viewer** → kết nối `app_viewer` (chỉ SELECT `teams`, `runs`, `logs`).

Role được lấy từ JWT trong mỗi request và đặt vào một `ThreadLocal`; khi transaction xin
connection, `RoutingDataSource` chọn đúng datasource. Nhờ đó ngay cả khi có lỗi ở tầng ứng dụng,
database vẫn là "hàng rào" cuối: một viewer về mặt vật lý không thể ghi dữ liệu.

Phân quyền còn được chặn thêm ở tầng Spring Security (mọi POST/PUT/PATCH/DELETE `/api/**` yêu cầu
role ADMIN; `/api/audit/**` chỉ ADMIN).

---

## 2. Yêu cầu

- Java 21+
- Maven 3.9+ (hoặc dùng `mvnw` nếu bạn thêm wrapper)
- PostgreSQL đã chạy `init_basic_int.txt` (database `hackathon` — chữ thường, các role `app_admin`,
  `app_viewer`, `svc_ingest`, `radius_reader`)

---

## 3. Cấu hình

Cấu hình khai báo trong file **`.env`** ở thư mục gốc dự án (đã có sẵn `.env`; mẫu ở `.env.example`).
Backend dùng thư viện **spring-dotenv** để tự nạp `.env` vào Spring lúc khởi động, nên `application.yml`
lấy giá trị từ đó — không cần set biến môi trường thủ công. Ba điểm cần chú ý:

1. **Tên database chữ thường**: `init_basic_int.txt` tạo `CREATE DATABASE hackathon` →
   `HACKATHON_DB_NAME=hackathon`. Gõ hoa/thường lẫn lộn sẽ làm backend báo lỗi
   "database does not exist".
2. **Đổi mật khẩu role và JWT secret** trước khi chạy thật (`doi_mat_khau_1..4`, `APP_JWT_SECRET`).
3. **Tài khoản admin cần bcrypt hash thật**: dữ liệu mẫu để `'$2a$10$THAY_BANG_HASH_THAT'` (hash giả) →
   không đăng nhập được. Sinh hash rồi cập nhật DB:

   ```bash
   mvn -q compile exec:java \
     -Dexec.mainClass="com.hackathon.backend.tool.HashGen" \
     -Dexec.args="matkhau_admin"
   # -> copy chuỗi $2a$... in ra, rồi:
   #   UPDATE app_users SET password_hash = '<hash>' WHERE username = 'admin';
   ```

---

## 4. Build & chạy

```bash
cd backend
mvn clean package          # bước này tải dependency từ Maven Central
java -jar target/backend-1.0.0.jar
# hoặc khi phát triển:
mvn spring-boot:run
```

Mặc định chạy ở `http://localhost:8080`.

---

## 5. Danh sách API

Mọi endpoint (trừ `/api/auth/login`) cần header `Authorization: Bearer <token>`.

| Method | Đường dẫn | Quyền | Mô tả |
|---|---|---|---|
| POST | `/api/auth/login` | công khai | Đăng nhập, trả JWT |
| GET  | `/api/auth/me` | admin, viewer | Thông tin phiên hiện tại |
| GET  | `/api/teams` | admin, viewer | Danh sách đội |
| GET  | `/api/teams/{id}` | admin, viewer | Chi tiết một đội |
| PATCH | `/api/teams/{id}` | admin | Sửa ghi chú / bật-tắt `is_active` |
| POST | `/api/teams/{id}/revoke` | admin | **Thu hồi** quyền WiFi (`is_active=false`) |
| POST | `/api/teams/{id}/restore` | admin | **Cấp lại** quyền WiFi (`is_active=true`) |
| GET  | `/api/runs` (`?status=running\|finished\|unscored`) | admin, viewer | Danh sách lượt chạy |
| GET  | `/api/runs/{id}` | admin, viewer | Chi tiết một lượt |
| POST | `/api/runs` | admin | Mở lượt chạy mới cho một đội (heat_no tự tăng) |
| POST | `/api/runs/{id}/finish` | admin | Kết thúc lượt (`status=finished`) |
| POST | `/api/runs/{id}/void` | admin | Hủy lượt (`status=unscored`, **giữ nguyên log**) |
| GET  | `/api/runs/{id}/stats` | admin, viewer | Thống kê: số gói, độ trễ, ước lượng mất gói, thời lượng |
| GET  | `/api/runs/{id}/logs` (`?page=&size=`) | admin, viewer | Log thô của lượt (phân trang, size ≤ 2000) |
| GET  | `/api/teams/{id}/runs` | admin, viewer | Các lượt của một đội |
| GET  | `/api/leaderboard` | admin, viewer | Bảng xếp hạng theo đội |
| GET  | `/api/audit` (`?page=&size=`) | admin | Nhật ký thao tác |

**Không có** endpoint tạo/xóa đội — theo yêu cầu, 10–15 đội được cấu hình sẵn trong DB, không thêm không xóa.
Việc "thu hồi quyền của một đội mà không ảnh hưởng đội khác" thực hiện qua `revoke`/`restore` (`is_active`).

Xem `api-examples.http` để có ví dụ gọi cụ thể.

---

## 6. Tích hợp RADIUS

**Phía Postgres/backend đã xong.** `teams.password_hash` (bcrypt) đã được thay bằng
`teams.nt_hash` — bcrypt là hàm một chiều, không thể suy ra NT-hash từ đó, nên MSCHAPv2
(dùng trong PEAP, xem Mục IV báo cáo triển khai) không thể dùng chung cột với web được.

- **Sinh NT-hash cho một đội**:
  ```bash
  mvn -q compile exec:java \
    -Dexec.mainClass="com.hackathon.backend.tool.NtHashGen" \
    -Dexec.args="matkhau_doi"
  # -> UPDATE teams SET nt_hash = '<hash in ra>' WHERE username = 'team01';
  ```
  Dùng **`NtHashGen`**, không dùng `HashGen` (HashGen sinh bcrypt, chỉ dành cho `app_users`).
- **Role đọc riêng cho FreeRADIUS**: `radius_reader`, chỉ `GRANT SELECT` trên 3 cột
  `(username, nt_hash, is_active)` của `teams` — không đọc được `team_name`, `note`,
  `mac_address`... (đã tạo sẵn trong `init_basic_int.txt`).

**Còn lại — phía máy FreeRADIUS (Ubuntu), làm theo báo cáo triển khai:**
bật module `mods-enabled/sql`, trỏ `login`/`password` vào role `radius_reader`, và sửa
`queries.conf` để `authorize_check_query` đọc đúng 3 cột trên thay vì bảng `radcheck`
mặc định:
```sql
SELECT username, 'NT-Password' AS attribute, nt_hash AS value, ':=' AS op
FROM teams WHERE username = '%{SQL-User-Name}' AND is_active = true;
```
Nhờ điều kiện `is_active = true` và việc FreeRADIUS đọc lại DB ở **mỗi lần** xe kết nối
(không cache), `revoke` một đội trên web có hiệu lực ngay từ lần xác thực kế tiếp — không
cần đụng gì tới máy Ubuntu.

Chỗ để cắm code nếu cần mở rộng thêm (ví dụ tự động sinh NT-hash khi tạo đội) nằm ở
`TeamService`.

---

## 7. Ghi chú về ingest log (giữ Python)

`ingest_server.py` vẫn là dịch vụ nhận UDP ~2000 gói/giây, ghi batch xuống bảng `logs` bằng role
`svc_ingest`. Backend này **không** đụng vào đó và **không** ghi bảng `logs` (chỉ đọc để thống kê).
Hai tiến trình chạy song song trên cùng database là hoàn toàn bình thường.
