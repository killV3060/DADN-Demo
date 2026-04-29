# Yolobit IoT Dashboard — v2 (MQTT over WiFi)

Tài liệu này mô tả sự thay đổi kiến trúc từ nhánh **master** (kết nối USB Serial) sang nhánh **dev** (kết nối MQTT qua WiFi), đồng thời hướng dẫn cách triển khai hệ thống mới.

---

## Tổng quan thay đổi

| | Master (v1) | Dev (v2) |
|---|---|---|
| **Kết nối Yolobit** | Cáp USB → COM port | WiFi → MQTT Broker |
| **Nguồn điện board** | Lấy từ máy tính qua USB | Pin 18650 hoặc adapter 5V độc lập |
| **Khoảng cách** | Bị giới hạn bởi dây USB | Tự do trong tầm WiFi |
| **Định dạng dữ liệu** | `!1:T:28.5#!1:H:54.2#!1:L:61#` | JSON: `{"temperature": 28.5, "humidity": 54.2, ...}` |
| **Định dạng lệnh** | Plain text: `"5"`, `"3"`, ... | JSON: `{"command":"FAN:33"}` hoặc plain text |
| **Thiết bị hỗ trợ** | Chỉ máy tính có COM port | Mọi thiết bị có WiFi (điện thoại, tablet, PC) |
| **Số lượng thiết bị** | 1 board / 1 cổng COM | Nhiều board qua DEVICE_ID |
| **Chuẩn công nghiệp** | Không | ✅ MQTT là chuẩn IoT |

---

## Kiến trúc mới (v2)

```
┌──────────────────────────────────────────────────────────────┐
│                     WiFi Network (killV / Vinh)              │
│                                                              │
│   Yolobit Board               MQTT Broker (Mosquitto)        │
│   [pin + WiFi]  ──publish──▶  [34.1.136.26:1883]            │
│                 ◀─subscribe─  topic: yolobit/command/1       │
│                               topic: yolobit/sensor/1        │
│                                    │                         │
│   Điện thoại / Web / App ──────────┤                         │
│   (bất kỳ thiết bị WiFi)          │                         │
│                               API Server (Node.js)           │
│                               subscribe MQTT                 │
│                               expose HTTP /api/*             │
│                                    │                         │
│                               Dashboard (React)              │
│                               polling 1s / WebSocket         │
└──────────────────────────────────────────────────────────────┘
```

---

## Luồng dữ liệu chi tiết

### Chiều đọc (Sensor → Dashboard)

```
1. Yolobit đọc cảm biến mỗi 200ms
2. Mỗi 10 giây, publish lên MQTT topic:
   Topic:   yolobit/sensor/1
   Payload: {
     "deviceId": "1",
     "source": "mqtt-device",
     "temperature": 28.5,
     "humidity": 54.2,
     "luminosity": 61,
     "timestamp": 1718000000
   }
3. API Server (subscribe topic này) nhận JSON → lưu vào state
4. Dashboard gọi GET /api/data mỗi 1 giây → hiển thị lên màn hình
```

### Chiều điều khiển (Dashboard → Yolobit)

```
1. Người dùng nhấn nút trên Dashboard
2. POST /api/control { "command": "FAN:33" }
3. API Server publish lên MQTT:
   Topic:   yolobit/command/1
   Payload: {"command": "FAN:33"}
4. Yolobit nhận → parse JSON → thực thi lệnh (bật quạt 33%)
```

---

## Bảng lệnh điều khiển (v2)

| Lệnh | Hành động |
|---|---|
| `"1"` | Servo quay 0° (mở) |
| `"2"` | Servo quay 180° (đóng) |
| `"3"` | LED bật (đỏ) |
| `"4"` | LED tắt |
| `"FAN:0"` | Quạt tắt |
| `"FAN:33"` | Quạt 33% |
| `"FAN:100"` | Quạt 100% |
| `"TEMP:35"` | Đặt ngưỡng nhiệt độ tối đa = 35°C |
| `"HUMID:40"` | Đặt ngưỡng độ ẩm tối thiểu = 40% |

> **Lưu ý:** v2 thay đổi cú pháp lệnh quạt từ số đơn (`5`, `6`, `7`, `8`) sang dạng `FAN:X` rõ ràng hơn.

---

## Cấu trúc thư mục mới (nhánh dev)

```
workspace/
├── artifacts/
│   ├── api-server/
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── yolobit.ts     # v1: đọc Serial USB (master)
│   │       │   └── mqtt.ts        # v2: kết nối MQTT broker (dev) ← MỚI
│   │       └── routes/
│   │           └── iot.ts         # Controller (cập nhật để dùng MQTT)
│   └── iot-dashboard/             # Frontend React (cập nhật lệnh FAN:X)
├── device/                        # ← THƯ MỤC MỚI (nhánh dev)
│   └── device.py                  # Code MicroPython chạy trên Yolobit (MQTT)
└── ...
```

---

## Cài đặt MQTT Broker (Mosquitto) trên Windows

Bước này chỉ cần nếu bạn tự host broker, không dùng server `34.1.136.26`.

**1. Tải Mosquitto:**
- Vào [mosquitto.org/download](https://mosquitto.org/download/) → tải bản Windows

**2. Cài đặt và chạy:**
```cmd
# Mở Command Prompt với quyền Admin
net start mosquitto
```

**3. Kiểm tra hoạt động:**
```cmd
mosquitto_sub -h localhost -t "yolobit/sensor/1"
```
Khi Yolobit gửi dữ liệu, bạn sẽ thấy JSON hiện ra ở terminal.

---

## Chạy dự án (nhánh dev)

### Yêu cầu thêm so với v1

```bash
pnpm --filter @workspace/api-server add mqtt
```

### Cấu hình biến môi trường

Tạo file `.env` trong `artifacts/api-server/`:

```env
PORT=8080
MQTT_BROKER=34.1.136.26
MQTT_PORT=1883
```

### Chạy backend

```bash
PORT=8080 pnpm --filter @workspace/api-server run dev
```

### Chạy frontend

```bash
pnpm --filter @workspace/iot-dashboard run dev
```

---

## Upload code lên Yolobit (device.py)

1. Mở **Thonny IDE** hoặc **Yolo:Bit IDE**
2. Kết nối Yolobit qua USB (chỉ để upload, sau đó rút ra)
3. Cài thư viện `umqtt.simple` cho MicroPython nếu chưa có
4. Upload file `device/device.py` lên board
5. Rút cáp USB, cấp nguồn bằng pin 18650 hoặc củ sạc 5V
6. Board tự động kết nối WiFi `Vinh` và gửi dữ liệu lên MQTT

---

## Kết nối từ điện thoại / thiết bị ngoại vi

Vì v2 dùng MQTT, **bất kỳ thiết bị nào trong cùng mạng WiFi** đều có thể:

### Xem dữ liệu cảm biến (subscribe)
Dùng app **MQTT Explorer** (Android/iOS/PC) hoặc **IoT MQTT Panel**:
- Broker: `34.1.136.26`
- Port: `1883`
- Subscribe topic: `yolobit/sensor/1`

### Gửi lệnh điều khiển (publish)
- Publish lên topic: `yolobit/command/1`
- Payload: `{"command": "FAN:100"}`

### Qua Dashboard web
- Truy cập `http://<IP-máy-tính>:5173` từ trình duyệt điện thoại
- Điện thoại và máy tính phải cùng mạng WiFi

---

## So sánh chi tiết code thay đổi

### Model layer (`yolobit.ts` → `mqtt.ts`)

| | v1 (Serial) | v2 (MQTT) |
|---|---|---|
| Thư viện | `serialport` | `mqtt` (npm) |
| Kết nối | `new SerialPort({ path: "COM3" })` | `mqtt.connect("mqtt://broker")` |
| Nhận data | Event `data` từ serial stream | Subscribe topic, event `message` |
| Parse | Regex: `!1:T:([\d.]+)#` | `JSON.parse(payload)` |
| Gửi lệnh | `port.write("5")` | `client.publish(topic, JSON.stringify({command}))` |
| Reconnect | `setTimeout` mở lại COM port | MQTT tự reconnect qua option `reconnectPeriod` |

### Format lệnh

```
v1:  "5"           → quạt 33%
v2:  "FAN:33"      → quạt 33%  (rõ ràng hơn)

v1:  len(cmd)==7   → set temp_max (kiểu "0000035")
v2:  "TEMP:35"     → set temp_max (dễ đọc hơn)
```

---

## Ghi chú

- File `device.py` trên nhánh dev tương đương `yolobit.py` trên master, nhưng thay thế toàn bộ phần Serial + print bằng MQTT publish/subscribe
- MQTT Broker `34.1.136.26` đang là server dùng chung — khi deploy thực tế nên dùng broker riêng có authentication
- `DEVICE_ID = "1"` cho phép mở rộng nhiều board bằng cách thay đổi ID
