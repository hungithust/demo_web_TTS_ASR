# Backend TTS/ASR Demo — Design Spec

Date: 2026-06-15
Scope: **Backend only**. Frontend và engine AT/ASR engine thật nằm ngoài phạm vi.

## 1. Mục tiêu & nguyên tắc

Backend FastAPI làm lớp trung gian giữa Frontend và engine TTS/ASR do bên AI cung cấp.
Yêu cầu cốt lõi:

- **Chuẩn schema/contract** với FE: định nghĩa cứng request/response đúng `SPEECH_DEMO_REQUIREMENTS.md`.
- **Độc lập module**: FE, Backend, Engine là 3 ranh giới tách biệt qua interface rõ ràng.
- **Chạy được ngay** khi engine chưa có: mặc định `MOCK_MODE=true`, trả dữ liệu giả hợp lệ (audio phát được, text có nghĩa).
- Không database.

## 2. Ba ranh giới độc lập

1. **FE ↔ Backend** — định nghĩa trong `app/schemas.py`. FE chỉ phụ thuộc các Pydantic model này.
2. **Backend ↔ Engine** — interface `EngineClient` (Protocol). Chọn impl (`mock` / `http`) qua env `MOCK_MODE`. Engine thật chỉ cần implement interface, không đụng router/service.
3. **Service ↔ Config** — danh sách model nằm ở `models.yaml`, không nhúng vào code.

## 3. Cấu trúc thư mục

```
backend/
├── app/
│   ├── main.py            # khởi tạo FastAPI, CORS, mount routers, /health, error handlers
│   ├── config.py          # Settings (pydantic-settings) đọc env
│   ├── schemas.py         # CONTRACT với FE: request/response models
│   ├── routers/
│   │   ├── tts.py         # GET /api/tts/models, POST /api/tts
│   │   └── asr.py         # GET /api/asr/models, POST /api/asr
│   ├── services/
│   │   ├── models_registry.py  # đọc danh sách model từ models.yaml
│   │   └── speech_service.py   # validate model_name, điều phối engine_client
│   ├── engine_client/
│   │   ├── base.py        # interface EngineClient (Protocol) + factory
│   │   ├── http_client.py # impl thật bằng httpx (contract giả định REST+base64)
│   │   └── mock_client.py # impl mock: trả WAV beep base64 / text cố định
│   └── errors.py          # custom exceptions + HTTP exception handlers
├── tests/
│   ├── test_health.py
│   ├── test_tts.py
│   ├── test_asr.py
│   └── test_mock_client.py
├── assets/mock_tts.wav    # WAV thật để mock TTS phát được (sinh lúc build hoặc commit sẵn)
├── models.yaml            # danh sách model TTS/ASR
├── requirements.txt
├── Dockerfile
├── .env.example
└── README.md (backend-specific notes; README tổng ở root sẽ làm khi có FE)
```

## 4. API Contract (FE ↔ Backend)

| Method | Path | Request | Response |
|--------|------|---------|----------|
| GET | `/api/tts/models` | — | `["model_a", ...]` |
| POST | `/api/tts` | `{ "text": str, "model_name": str }` | `{ "voice": "<base64>" }` |
| GET | `/api/asr/models` | — | `["model_a", ...]` |
| POST | `/api/asr` | `{ "voice": "<base64>", "model_name": str }` | `{ "text": str }` |
| GET | `/health` | — | `{ "status": "ok" }` |

### Pydantic schemas (`schemas.py`)
- `TTSRequest`: `text: str` (min_length=1, strip), `model_name: str`.
- `TTSResponse`: `voice: str` (base64).
- `ASRRequest`: `voice: str` (min_length=1), `model_name: str`.
- `ASRResponse`: `text: str`.
- Model list endpoints trả `list[str]` trực tiếp.

## 5. Contract giả định cho engine thật (`http_client.py`)

REST + base64, có thể chỉnh khi engine thật khác:

- **TTS**: `POST {TTS_ENGINE_URL}` body `{ "text", "model_name" }`, header `Authorization: Bearer {ENGINE_API_KEY}` → `{ "audio_base64": str }`.
- **ASR**: `POST {ASR_ENGINE_URL}` body `{ "audio_base64", "model_name" }`, header tương tự → `{ "text": str }`.

Khi engine thật có contract khác → chỉ sửa mapping trong `http_client.py`, không lan ra router/service/schemas.

### Interface (`base.py`)
```python
class EngineClient(Protocol):
    async def synthesize(self, text: str, model_name: str) -> str: ...   # trả base64 audio
    async def transcribe(self, voice_b64: str, model_name: str) -> str: ...  # trả text

def get_engine_client(settings) -> EngineClient:  # factory theo MOCK_MODE
```

## 6. Mock behavior (`mock_client.py`)

- `synthesize` → trả base64 của `assets/mock_tts.wav` (một WAV beep ngắn, phát được trên FE).
- `transcribe` → trả text cố định có nghĩa, ví dụ: `"[mock] Đây là kết quả nhận dạng giả lập cho model {model_name}."`.
- Không gọi mạng; dùng để FE test end-to-end.

## 7. Validation & Error handling (`errors.py`)

| Tình huống | HTTP | Ghi chú |
|-----------|------|---------|
| `text` rỗng / `voice` rỗng | 422 | Pydantic validation |
| `model_name` không thuộc registry | 400 | `InvalidModelError` |
| `voice` không decode được base64 | 400 | `InvalidAudioError` |
| Engine trả lỗi (status != 2xx) | 502 | `EngineError` |
| Engine timeout/không kết nối | 504 | `EngineTimeoutError` |

Tất cả lỗi trả JSON `{ "detail": "<message rõ ràng>" }`. CORS bật theo `CORS_ORIGINS`.

## 8. Cấu hình (`.env.example`)

```
MOCK_MODE=true
TTS_ENGINE_URL=
ASR_ENGINE_URL=
ENGINE_API_KEY=
CORS_ORIGINS=http://localhost:3000
PORT=8000
ENGINE_TIMEOUT=30
```

`models.yaml`:
```yaml
tts: [model_a, model_b, model_c]
asr: [model_a, model_b]
```

## 9. Testing (pytest + httpx TestClient)

- `test_health`: `/health` → 200.
- `test_tts`: models list shape; POST hợp lệ (mock) → `{voice}` là base64 decode được; text rỗng → 422; model sai → 400.
- `test_asr`: models list; POST hợp lệ → `{text}`; voice rỗng → 422; base64 sai → 400; model sai → 400.
- `test_mock_client`: synthesize trả base64 hợp lệ, transcribe trả text non-empty.

Test chạy hoàn toàn ở MOCK_MODE, không cần engine thật → CI/transfer chạy ngay.

## 10. Đóng gói

- `Dockerfile`: python slim, install requirements, `uvicorn app.main:app --host 0.0.0.0 --port 8000`.
- Phần service `backend` trong `docker-compose.yml` ở root sẽ thêm khi làm FE (ngoài scope hiện tại); design này đảm bảo backend chạy standalone qua Docker.

## 11. Ngoài phạm vi

- Frontend (NodeJS).
- Engine TTS/ASR thật.
- Database (không dùng).
- `docker-compose.yml` tổng + README root (làm cùng FE).
