# Yolobit Smart Home IoT Dashboard

Hệ thống giám sát và điều khiển IoT thời gian thực cho bo mạch Yolobit. Dự án sử dụng kiến trúc full-stack MVC, đọc dữ liệu cảm biến từ phần cứng qua cổng Serial (USB), hiển thị trực tiếp trên web dashboard hiện đại.

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
```

### 4. Chạy Backend (API Server)

Mở terminal **thứ nhất**, chạy:

```bash
pnpm --filter @workspace/api-server run dev
```

> Server sẽ khởi động tại `http://localhost:8080`

### 5. Chạy Frontend (Dashboard)

Mở terminal **thứ hai**, chạy:

```bash
pnpm --filter @workspace/iot-dashboard run dev
```

> Dashboard sẽ mở tại `http://localhost:5173`

---

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

1. Mở `http://localhost:5173` trên trình duyệt
2. Ở panel **Device Status** phía trên trang, chọn **COM3** từ dropdown
3. Nhấn nút **Connect**
4. Đèn trạng thái chuyển sang **xanh lá** → dữ liệu cảm biến bắt đầu cập nhật theo thời gian thực

---

## Demo Mode (Không cần phần cứng)

Nếu chưa có Yolobit hoặc muốn test giao diện:

1. Trong dropdown cổng, chọn **demo**
2. Nhấn **Connect**
3. Hệ thống sẽ tự sinh dữ liệu giả lập nhiệt độ, độ ẩm, ánh sáng dao động tự nhiên

---

## Cấu trúc Dự án

```
workspace/
├── artifacts/
│   ├── api-server/          # Backend Express API (đọc serial, xử lý lệnh)
│   │   └── src/
│   │       ├── lib/
│   │       │   └── yolobit.ts   # Model: kết nối serial, parse dữ liệu
│   │       └── routes/
│   │           └── iot.ts       # Controller: các API endpoint
│   └── iot-dashboard/       # Frontend React + Vite
│       └── src/
│           ├── pages/
│           │   └── Dashboard.tsx
│           └── components/
│               └── dashboard/   # SensorCard, ControlPanel, v.v.
├── lib/
│   ├── api-spec/            # OpenAPI spec (hợp đồng API)
│   ├── api-zod/             # Zod schema tự động sinh từ OpenAPI
│   └── api-client-react/    # React Query hooks tự động sinh từ OpenAPI
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
│  CONTROLLER — iot.ts                    │
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

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/data` | Dữ liệu cảm biến mới nhất |
| POST | `/api/control` | Gửi lệnh điều khiển (1–10) |
| GET | `/api/thresholds` | Lấy ngưỡng cảnh báo |
| POST | `/api/thresholds` | Cập nhật ngưỡng |
| GET | `/api/connection` | Trạng thái kết nối |
| POST | `/api/connection` | Kết nối cổng COM hoặc demo |
| GET | `/api/ports` | Danh sách cổng COM có sẵn |

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

- Nếu `COM3` không xuất hiện trong dropdown, kiểm tra lại driver CH340 và thử rút cắm lại USB
- Baud rate mặc định là **115200** — phải khớp với cấu hình trong `yolobit.py`
- Chỉ **một chương trình** được mở cổng COM tại một thời điểm — đóng Thonny/IDE trước khi dùng dashboard
- Nếu gặp lỗi `Access denied` trên cổng COM: mở **Task Manager** và tắt mọi process đang dùng cổng đó
