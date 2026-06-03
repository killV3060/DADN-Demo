# Yolobit Smart Home IoT Dashboard

Hệ thống giám sát và điều khiển IoT thời gian thực cho bo mạch Yolobit. Dự án sử dụng kiến trúc full-stack MVC, đọc dữ liệu cảm biến từ phần cứng qua cổng Serial (USB) hoặc MQTT, hiển thị trực tiếp trên web dashboard hiện đại.

Hệ thống có **RBAC (Role-Based Access Control)** với JWT: phân quyền theo vai trò `admin`, `developer`, `user` và khách `guest` (chưa đăng nhập). Luồng USB/MQTT và polling realtime **không bị thay đổi** — RBAC chỉ áp dụng trên HTTP API và giao diện.

> Tài liệu chi tiết RBAC: [READMEPRIORITY.md](./READMEPRIORITY.md)

---

## Yêu cầu hệ thống (Windows)

- **Windows 10/11** (64-bit)
- **Node.js** v20 trở lên → [Tải tại đây](https://nodejs.org)
- **pnpm** (package manager)
- **Driver USB Yolobit** (CH340) → [Tải tại đây](https://sparks.gogo.co.nz/ch340.html) — cần thiết để máy nhận dạng cổng COM
- Cáp USB kết nối Yolobit với máy tính

---

## Cài đặt & Chạy (Quick Start)

### 1. Cài pnpm (nếu chưa có)

```bash
npm install -g pnpm
```

### 2. Clone và cài dependencies

```bash
git clone <your-repo-url>
cd <repo-folder>
pnpm install
```

### 3. Cấu hình biến môi trường chung (.env)

Tạo file `.env` ở thư mục gốc project với nội dung:

```bash
API_PORT=8080
WEB_PORT=5173
BASE_PATH=/
DATABASE_URL=postgres://postgres:password@localhost:5432/yolobit_db
JWT_SECRET=change-me-to-a-long-random-secret-in-production
JWT_EXPIRES_IN=24h
MQTT_URL=mqtt://localhost:1883
MQTT_SENSOR_TOPIC=yolobit/sensor/+
MQTT_COMMAND_TOPIC=yolobit/command
```

Hoặc sao chép từ mẫu: `cp .env.example .env`

### 3.1. Khởi tạo cơ sở dữ liệu (PostgreSQL)

Chạy migration Drizzle để tạo bảng cảm biến, lệnh và **bảng `users`** (RBAC):

```bash
pnpm push
```

### 4. Chạy Backend (API Server)

Mở terminal **thứ nhất**, chạy:

```bash
pnpm --filter @workspace/api-server run dev
```

> Server sẽ khởi động tại `http://localhost:8080`  
> Lần đầu chạy (bảng `users` trống), API tự seed tài khoản demo: `admin`, `developer`, `user`.

### 5. Chạy Frontend (Dashboard)

Mở terminal **thứ hai**, chạy:

```bash
pnpm --filter @workspace/iot-dashboard run dev
```

> Dashboard sẽ mở tại `http://localhost:5173`

---

## Cách build và chạy app bằng Docker
### 1. Cài đặt Docker Desktop (khuyên dùng) hoặc Docker Engine

Truy cập `https://docs.docker.com/desktop/` để tải và cài đặt Docker Desktop.\
Sau đó khởi động Docker Desktop để ứng dụng chạy dưới nền

### 2. Build app

Dùng terminal để truy cập vào thư mục dự án

```bash
cd <repo-folder>
```

Sau đó tiến hành build app bằng lệnh:

```bash
# File .env ở thư mục gốc phải có JWT_SECRET
docker compose up --build
```

> Sau khi build xong, Dashboard sẽ được mở tại `http://localhost:80`  
> Docker Compose truyền `JWT_SECRET` và `JWT_EXPIRES_IN` vào service `api-server`.

## Kết nối Yolobit qua USB (COM3)

### Bước 1 — Cài driver CH340

Tải và cài driver CH340 từ link ở mục yêu cầu hệ thống. Sau khi cài, khởi động lại máy nếu cần.

### Bước 2 — Kiểm tra cổng COM

1. Cắm Yolobit vào máy qua cáp USB
2. Nhấn `Win + X` → chọn **Device Manager**
3. Mở mục **Ports (COM & LPT)**
4. Tìm thiết bị tên **USB-SERIAL CH340** → ghi nhớ số COM (ví dụ: **COM3**)

### Bước 3 — Upload code lên Yolobit

Dùng phần mềm **Yolo:Bit IDE** hoặc **Thonny** để upload file `yolobit.py` lên board. Board sẽ tự kết nối WiFi `killV` và bắt đầu gửi dữ liệu cảm biến qua USB mỗi 30 giây theo định dạng:

```
!1:T:28.5#!1:H:54.2#!1:L:61#
```

### Bước 4 — Kết nối trong Dashboard

1. Mở `http://localhost:5173` và **đăng nhập tài khoản `admin`** (kết nối USB/COM yêu cầu quyền admin)
2. Ở panel **Device Status** phía trên trang, chọn **COM3** từ dropdown
3. Nhấn nút **Connect**
4. Đèn trạng thái chuyển sang **xanh lá** → dữ liệu cảm biến bắt đầu cập nhật theo thời gian thực

> Role `user` chỉ **xem** trạng thái kết nối (read-only). Role `guest` / `developer` không có panel quản lý kết nối.

---

## Đăng nhập & Phân quyền (RBAC)

### Vai trò

| Vai trò | Mô tả |
|--------|--------|
| **guest** | Chưa đăng nhập — chỉ xem nhiệt độ & độ ẩm |
| **user** | Xem dashboard, trạng thái kết nối — không điều khiển thiết bị / ngưỡng |
| **developer** | Xem dashboard, chỉnh ngưỡng, xem lịch sử — không điều khiển vật lý / quản lý user |
| **admin** | Toàn quyền: điều khiển, kết nối USB/MQTT, quản lý user |

### Tài khoản demo (seed tự động)

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | admin |
| developer | dev123 | developer |
| user | user123 | user |

### Trên Dashboard

1. Mở `http://localhost:5173` — truy cập **guest** (2 thẻ cảm biến).
2. Vào **Sign in** (`/login`) hoặc đăng nhập trực tiếp.
3. Giao diện thay đổi theo role (nút điều khiển, kết nối COM, ngưỡng chỉ hiện khi được phép).

Token JWT lưu trong `localStorage`; các API được bảo vệ gửi header `Authorization: Bearer <token>`.

---

## Demo Mode (Không cần phần cứng)

Nếu chưa có Yolobit hoặc muốn test giao diện:

1. Đăng nhập **`admin`**
2. Trong dropdown cổng, chọn **demo**
3. Nhấn **Connect**
4. Hệ thống sẽ tự sinh dữ liệu giả lập nhiệt độ, độ ẩm, ánh sáng dao động tự nhiên

> **Guest** vẫn xem được telemetry demo qua `GET /api/data` (polling 1s) mà không cần Connect.

---

## Cấu trúc Dự án

```
workspace/
├── artifacts/
│   ├── api-server/              # Backend Express API (serial, MQTT, auth)
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── yolobit.ts   # Model: USB serial, parse dữ liệu (không đổi)
│   │       │   ├── mqtt.ts      # MQTT client (không đổi)
│   │       │   └── auth/        # JWT, bcrypt, seed user
│   │       ├── middleware/
│   │       │   └── auth.ts      # RBAC + guest filter
│   │       └── routes/
│   │           ├── iot.ts       # Controller IoT (middleware bảo vệ)
│   │           └── auth.ts      # login, register, me
│   └── iot-dashboard/           # Frontend React + Vite
│       └── src/
│           ├── contexts/
│           │   └── AuthContext.tsx
│           ├── pages/
│           │   ├── Dashboard.tsx
│           │   └── Login.tsx
│           └── components/
│               ├── auth/        # RoleGuard, ProtectedRoute
│               └── dashboard/
├── lib/
│   ├── rbac/                # Enum role & ma trận permission (dùng chung FE/BE)
│   ├── db/                  # Drizzle schema (sensor, users, …)
│   ├── api-spec/
│   ├── api-zod/
│   └── api-client-react/
├── READMEPRIORITY.md        # Hướng dẫn RBAC đầy đủ (tiếng Anh)
└── README.md
```

---

## Công nghệ sử dụng

| Tầng | Công nghệ | Vai trò |
|---|---|---|
| **Bo mạch** | MicroPython | Chạy trực tiếp trên Yolobit |
| **Backend** | TypeScript + Node.js | Đọc cổng Serial USB, xử lý API |
| **API Framework** | Express 5 | Định tuyến HTTP |
| **Validation** | Zod + OpenAPI 3.1 | Kiểm tra dữ liệu đầu vào/ra |
| **Frontend** | React + TypeScript | Giao diện dashboard |
| **Build Tool** | Vite | Dev server & bundle |
| **Styling** | Tailwind CSS | Giao diện dark mode IoT |
| **Monorepo** | pnpm workspaces | Quản lý frontend + backend chung |
| **Database** | PostgreSQL + Drizzle ORM | Lịch sử cảm biến, bảng `users` |
| **Auth** | JWT + bcrypt | Đăng nhập, phân quyền API |
| **RBAC** | `@workspace/rbac` | Ma trận permission dùng chung |

---

## Luồng dữ liệu

```
Yolobit Board
     │
     │  USB Serial (115200 baud)  →  !1:T:28.5#!1:H:54.2#!1:L:61#
     ▼
┌─────────────────────────────────────────┐
│  MODEL — yolobit.ts                     │
│  SerialPort đọc bytes                   │
│  Regex parse  →  { T: 28.5, H: 54.2 }   │
│  Lưu vào bộ nhớ (in-memory state)       │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│  CONTROLLER — iot.ts + middleware RBAC  │
│  JWT (tuỳ chọn) → role: guest|user|…  │
│  GET  /api/data      → JSON cảm biến    │
│  POST /api/control   → ghi lệnh serial  │
│  GET  /api/thresholds→ ngưỡng cảnh báo  │
│  POST /api/connection→ kết nối cổng COM │
└──────────────────┬──────────────────────┘
                   │  HTTP polling mỗi 1 giây
┌──────────────────▼──────────────────────┐
│  VIEW — React Dashboard                 │
│  Hiển thị thẻ nhiệt độ / độ ẩm / sáng   │
│  Cảnh báo đỏ khi vượt ngưỡng            │
│  Nút điều khiển Servo / LED / Fan / RGB │
└─────────────────────────────────────────┘
```

### Cụ thể từng bước:

1. **Yolobit gửi dữ liệu** mỗi 30 giây qua USB: `!1:T:28.5#!1:H:54.2#!1:L:61#`
2. **Backend parse** bằng Regex: `!1:T:([\d.]+)#` → trích xuất số `28.5`
3. `parseFloat("28.5")` chuyển chuỗi thành số thực
4. **Frontend gọi** `GET /api/data` mỗi 1 giây (React Query)
5. **React render** số lên thẻ cảm biến, so sánh với ngưỡng để hiện cảnh báo
6. **Khi bấm nút điều khiển**: `POST /api/control { command: "5" }` → backend ghi `"5"` vào cổng serial → Yolobit nhận và bật quạt 33%

---

## API Endpoints

### Xác thực (`/api/auth`)

| Method | Endpoint | Mô tả | Quyền |
|---|---|---|---|
| POST | `/api/auth/login` | Đăng nhập, nhận JWT | Công khai |
| POST | `/api/auth/register` | Đăng ký (mặc định `user`) | Công khai |
| GET | `/api/auth/me` | Thông tin user hiện tại | Đã đăng nhập |
| GET | `/api/auth/users` | Danh sách user | `admin` |

### IoT (`/api`)

| Method | Endpoint | Mô tả | Quyền tối thiểu |
|---|---|---|---|
| GET | `/api/data` | Dữ liệu cảm biến mới nhất | Công khai / guest |
| POST | `/api/data` | Nhận telemetry từ WiFi/thiết bị ngoài | `admin` |
| GET | `/api/data/history?limit=100` | Lịch sử từ PostgreSQL | `developer`, `admin` |
| POST | `/api/control` | Gửi lệnh điều khiển (1–10) | `admin` |
| GET | `/api/thresholds` | Lấy ngưỡng cảnh báo | `developer`, `admin` |
| POST | `/api/thresholds` | Cập nhật ngưỡng | `developer`, `admin` |
| GET | `/api/connection` | Trạng thái kết nối | `user`, `admin` |
| POST | `/api/connection` | Kết nối cổng COM hoặc demo | `admin` |
| DELETE | `/api/connection` | Ngắt kết nối | `admin` |
| GET | `/api/ports` | Danh sách cổng COM | `admin` |

**Mã HTTP:** `401 Unauthorized` (token thiếu/hết hạn), `403 Forbidden` (đủ đăng nhập nhưng thiếu quyền).

**Guest** gọi `GET /api/data`: API trả về chỉ nhiệt độ & độ ẩm (ẩn độ sáng và cảnh báo ngưỡng).

### Ma trận quyền (tóm tắt)

| Quyền | guest | user | developer | admin |
|-------|:-----:|:----:|:---------:|:-----:|
| Xem telemetry (`GET /data`) | ✓ | ✓ | ✓ | ✓ |
| Xem trạng thái kết nối | | ✓ | | ✓ |
| Xem / sửa ngưỡng | | | ✓ | ✓ |
| Xem lịch sử | | | ✓ | ✓ |
| Điều khiển thiết bị | | | | ✓ |
| Quản lý kết nối USB/demo | | | | ✓ |
| Quản lý user | | | | ✓ |

### Kiểm thử nhanh (curl)

```bash
# Guest
curl http://localhost:8080/api/data

# Đăng nhập admin
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"admin123\"}"

# Dùng token (thay TOKEN bằng accessToken trong response)
curl http://localhost:8080/api/connection -H "Authorization: Bearer TOKEN"
```

Chi tiết middleware, JWT flow và test UI: [READMEPRIORITY.md](./READMEPRIORITY.md).

## MQTT pub/sub

- Broker mặc định khi chạy Docker nằm tại `mqtt://localhost:1883`
- Thiết bị publish dữ liệu cảm biến lên topic `yolobit/sensor`
- Dashboard/API publish lệnh điều khiển lên topic `yolobit/command`
- API server sẽ subscribe topic sensor để nhận dữ liệu từ thiết bị từ xa và lưu vào PostgreSQL

## Bảng lệnh điều khiển

| Lệnh | Hành động |
|---|---|
| `1` | Servo mở (0°) |
| `2` | Servo đóng (180°) |
| `3` | LED bật (đỏ) |
| `4` | LED tắt |
| `5` | Quạt 33% |
| `6` | Quạt 66% |
| `7` | Quạt 100% |
| `8` | Quạt tắt |
| `9` | RGB bật |
| `10` | RGB tắt |

---

## Lưu ý khi chạy trên Windows

- **JWT_SECRET** bắt buộc khi chạy API — không hardcode trong code; dùng `.env` hoặc biến Docker
- Sau `pnpm install`, nếu lỗi `bcrypt`: package đã khai báo trong `onlyBuiltDependencies` — chạy lại `pnpm install`
- Nếu `COM3` không xuất hiện trong dropdown, kiểm tra lại driver CH340 và thử rút cắm lại USB
- Baud rate mặc định là **115200** — phải khớp với cấu hình trong `yolobit.py`
- Chỉ **một chương trình** được mở cổng COM tại một thời điểm — đóng Thonny/IDE trước khi dùng dashboard
- Nếu gặp lỗi `Access denied` trên cổng COM: mở **Task Manager** và tắt mọi process đang dùng cổng đó
