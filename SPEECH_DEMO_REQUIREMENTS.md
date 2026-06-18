# Demo Web TTS & ASR — Requirements

Demo nhanh gồm 2 phần: **Frontend** (NodeJS) và **Backend** (Python/FastAPI), mỗi phần đóng gói bằng Docker. Không dùng database. Backend chỉ là lớp trung gian gọi sang TTS/ASR engine do bên AI cung cấp.

---

## 1. Tổng quan

- Trang chủ có 2 tab: **Text to Speech** và **ASR**. Mặc định mở tab **TTS**.
- Frontend gọi REST API của Backend; Backend gọi tiếp sang engine TTS/ASR thực tế.
- Mục tiêu: đơn giản, chạy được ngay bằng `docker compose up`.

---

## 2. Frontend

**Tech:** NodeJS, framework tự chọn (gợi ý React + Vite hoặc Next.js). Đóng gói Docker.

### Tab TTS
- Hiển thị **5 text samples** mẫu; click vào sample sẽ đổ text đó vào ô nhập.
- **Text box** cho người dùng nhập/sửa text.
- **Dropdown** chọn model TTS — danh sách model lấy từ API backend (`GET /api/tts/models`).
- Button **Convert Text to Speech**:
  - Gọi `POST /api/tts` với `{ text, model_name }`.
  - Nhận `{ voice: base64_str }`, decode base64 → phát qua **audio player**.
- Trạng thái loading khi đang xử lý; báo lỗi rõ ràng nếu fail.
- UI tham khảo: https://ai.zalo.solutions/products/text-to-audio-converter

### Tab ASR
- Hiển thị **5 audio samples** mẫu (wav/mp3); click để chọn làm input.
- 2 cách nhập audio:
  - Button **Upload file** (chấp nhận `.wav`, `.mp3`).
  - Button **Record** thu âm trực tiếp qua mic (MediaRecorder API).
- **Dropdown** chọn model ASR — lấy từ `GET /api/asr/models`.
- Button **Convert Speech to Text**:
  - Encode audio (upload/thu âm) sang base64, gọi `POST /api/asr` với `{ voice, model_name }`.
  - Nhận `{ text }`, hiển thị **text kết quả** lên UI.
- Trạng thái loading + báo lỗi.

### Yêu cầu chung
- Responsive cơ bản, gọn gàng.
- API base URL cấu hình qua biến môi trường (`VITE_API_BASE_URL` hoặc tương đương).
- File audio samples để trong `public/` của frontend.

---

## 3. Backend

**Tech:** Python, FastAPI, Pydantic. Đóng gói Docker. Không database.

> Backend wrap các API TTS/ASR engine do **bên AI cung cấp**. Endpoint/credential của engine để trong biến môi trường (`TTS_ENGINE_URL`, `ASR_ENGINE_URL`, `ENGINE_API_KEY`...). Trong giai đoạn engine chưa sẵn sàng, cho phép trả về **mock** để frontend chạy được.

### Endpoints

| Method | Path | Mô tả |
|--------|------|-------|
| `GET`  | `/api/tts/models` | Trả danh sách tên model TTS: `["model_a", "model_b", ...]` |
| `POST` | `/api/tts` | Body `{ text, model_name }` → gọi engine → trả voice base64 |
| `GET`  | `/api/asr/models` | Trả danh sách tên model ASR: `["model_a", "model_b", ...]` |
| `POST` | `/api/asr` | Body `{ voice, model_name }` → gọi engine → trả `{ text }` |
| `GET`  | `/health` | Health check |

### Chi tiết

**`GET /api/tts/models` và `GET /api/asr/models`**
- Response: list of strings — danh sách tên model.
  ```json
  ["model_a", "model_b", "model_c"]
  ```

**`POST /api/tts`**
- Request:
  ```json
  { "text": "string", "model_name": "string" }
  ```
- Validate: `text` không rỗng; `model_name` thuộc danh sách hợp lệ.
- Response: `voice` là chuỗi audio đã encode base64.
  ```json
  { "voice": "base64_str" }
  ```

**`POST /api/asr`**
- Request: `voice` là chuỗi audio (wav/mp3) đã encode base64.
  ```json
  { "voice": "base64_str", "model_name": "string" }
  ```
- Validate: `voice` không rỗng, decode được; `model_name` thuộc danh sách hợp lệ.
- Response:
  ```json
  { "text": "string" }
  ```

### Yêu cầu chung
- Bật **CORS** cho origin của frontend.
- Cấu hình qua env (engine URL, key, port).
- Xử lý lỗi → trả HTTP status + message rõ ràng (4xx cho input sai, 5xx khi engine lỗi).
- Engine TTS/ASR gọi qua HTTP client (httpx); tách thành module `engine_client` để dễ thay thế.

---

## 4. Đóng gói & chạy

- `frontend/Dockerfile`, `backend/Dockerfile`.
- `docker-compose.yml` ở root chạy cả 2 service:
  - backend: cổng `8000`.
  - frontend: cổng `3000` (hoặc `80`).
- `.env.example` liệt kê đầy đủ biến môi trường cần thiết.
- Lệnh chạy: `docker compose up --build`.

### README.md (bắt buộc — dạng user manual)

Phải có `README.md` ở root viết dạng hướng dẫn sử dụng, đảm bảo người nhận transfer code chạy được ngay mà không cần hỏi lại. Nội dung tối thiểu:

- **Giới thiệu ngắn**: demo làm gì, gồm những thành phần nào.
- **Yêu cầu môi trường**: phiên bản cần có (Docker, Docker Compose; NodeJS và Python nếu chạy không qua Docker).
- **Cấu hình**: cách tạo `.env` từ `.env.example`, giải thích từng biến môi trường (engine URL, API key, port...).
- **Cách chạy bằng Docker** (khuyến nghị): các bước `docker compose up --build`, địa chỉ truy cập frontend/backend, cách dừng.
- **Cách chạy thủ công (không Docker)**: 
  - Backend: tạo virtualenv, `pip install -r requirements.txt`, lệnh chạy `uvicorn`.
  - Frontend: `npm install`, `npm run dev` / `npm run build`.
- **Kiểm thử nhanh**: gọi thử `/health` và mô tả luồng demo cơ bản trên UI.
- **Ghi chú**: chế độ mock khi engine TTS/ASR chưa sẵn sàng, các lỗi thường gặp & cách xử lý.
