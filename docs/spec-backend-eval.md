# Spec triển khai Backend — TTS Evaluation (MOS & CMOS)

Tài liệu này biến `proposal.md` (phần backend) thành spec thực thi, bám sát codebase hiện tại
(`backend/app`). Mục tiêu: thêm module Evaluation **không phá vỡ** TTS/ASR đang chạy.

---

## 0. Phạm vi & nguyên tắc

- Thêm prefix mới `/api/eval`, tái dùng `FastAPI`, `app.state`, `engine_client`, `APIError`.
- Thêm **DB (SQLite)** chỉ cho phần Evaluation. TTS/ASR giữ nguyên (không DB).
- **Blind**: client không bao giờ nhận `model_id`. Mọi trial gắn `trial_id` (token mờ) → server tra ánh xạ.
- **Pre-generate**: audio test set sinh sẵn bằng script, lúc chấm chỉ serve file tĩnh.
- **Khử order-bias do FE**: backend trả cặp CMOS theo thứ tự cố định (`slot1`/`slot2`), không lưu vị trí trình bày.

---

## 1. Cấu trúc file mới

```
backend/
  app/
    db.py                      # engine + session SQLModel, init_db()
    models_eval.py             # bảng SQLModel: Sample, Model, Audio, Trial, MosScore, CmosScore
    schemas_eval.py            # Pydantic request/response cho /api/eval
    services/
      eval_service.py          # logic chọn trial, ghi điểm, tổng hợp kết quả
    routers/
      eval.py                  # router prefix /api/eval
  scripts/
    pregenerate.py             # sinh audio test set + seed DB
  static/audio/                # file .wav tĩnh (gitignore)
  data/eval.db                 # SQLite (gitignore)
  tests/
    test_eval.py
```

Sửa file có sẵn:
- `main.py`: gọi `init_db()`, `app.mount("/static", StaticFiles(...))`, `app.include_router(eval.router)`, gắn `EvalService` vào `app.state`.
- `config.py`: thêm `database_url`, `static_dir`, `audio_dir`, `min_votes`.
- `requirements`: thêm `sqlmodel` (kéo theo SQLAlchemy), `aiofiles` (nếu cần).

---

## 2. Config bổ sung (`config.py`)

```python
database_url: str = "sqlite:///data/eval.db"
static_dir: str   = "static"
audio_dir: str    = "static/audio"
min_votes: int    = 20          # ngưỡng xếp hạng MOS
```

---

## 3. Schema DB (`models_eval.py`)

Dùng SQLModel. Tóm tắt (chi tiết cột xem `proposal.md` §6):

| Bảng | Cột chính | Ghi chú |
|------|-----------|---------|
| `samples` | `id PK`, `text` | seed từ test set |
| `models` | `id PK`, `name` | id = tên trong `models.yaml` |
| `audios` | `id PK`, `sample_id FK`, `model_id FK`, `audio_url`, `UNIQUE(sample_id, model_id)` | do script pre-generate ghi |
| `trials` | `id PK (trial_id)`, `kind`, `session_id`, `sample_id`, `model_id`, `model_slot1`, `model_slot2`, `created_at`, `consumed BOOL` | ánh xạ token mờ → nội dung thật |
| `mos_scores` | `id PK`, `trial_id FK`, `session_id`, `sample_id`, `model_id`, `score REAL`, `created_at` | |
| `cmos_scores` | `id PK`, `trial_id FK`, `session_id`, `sample_id`, `model_slot1`, `model_slot2`, `choice`, `created_at` | cặp theo thứ tự cố định |

Quy ước: với CMOS, `model_slot1`, `model_slot2` luôn sort ổn định theo `model_id` (slot1 < slot2).

---

## 4. API Endpoints (`routers/eval.py` + `schemas_eval.py`)

Tất cả dưới prefix `/api/eval`, theo pattern router hiện tại (lấy service qua `request.app.state`).

### 4.1 `GET /api/eval/mos/next?session_id=...`
- Chọn `(sample, model)` ưu tiên tổ hợp ít phiếu nhất, tránh sample vừa nghe trong session.
- Tạo `Trial(kind="mos", session_id, sample_id, model_id)`, lưu DB.
- **Response** `MosNextResponse`:
  ```json
  { "trial_id": "t_...", "sample_id": "s1", "audio_url": "/static/audio/<hash>.wav" }
  ```
- Không có audio khả dụng → `204` hoặc payload `{ "trial_id": null }` (empty state cho FE).

### 4.2 `POST /api/eval/mos/submit`
- Body `MosSubmitRequest`: `{ trial_id, score, session_id }`.
- Validate: `score ∈ {0, 0.5, …, 5}` (Pydantic `field_validator`); trial tồn tại, `kind=="mos"`, `consumed==False`, `session_id` khớp.
- Ghi `mos_scores`, set `trial.consumed=True`.
- Lỗi → `InvalidModelError`/`APIError` 400 (trial sai/đã dùng), giữ format `{ "detail": ... }`.
- **Response**: `{ "ok": true }`.

### 4.3 `GET /api/eval/cmos/next?session_id=...`
- Chọn `(sample, modelA, modelB)` khác nhau, ưu tiên cặp ít phiếu; sort 2 model → `slot1`, `slot2`.
- Tạo `Trial(kind="cmos", session_id, sample_id, model_slot1, model_slot2)`.
- **Response** `CmosNextResponse`:
  ```json
  { "trial_id": "t_...", "sample_id": "s1", "slot1_url": "...", "slot2_url": "..." }
  ```

### 4.4 `POST /api/eval/cmos/submit`
- Body `CmosSubmitRequest`: `{ trial_id, choice, session_id }`, `choice ∈ {"slot1","slot2","same"}`.
- Validate giống MOS; ghi `cmos_scores`, set `consumed`.
- **Response**: `{ "ok": true }`.

### 4.5 `GET /api/eval/mos/results` và `GET /api/eval/cmos/results`
- MOS: mỗi model trả `{ model_id, name, mos, n, std, ci95 }`, chỉ rank `n ≥ min_votes`, sort desc.
- CMOS: ma trận cặp + `win_rate(slot1 vs slot2) = (#slot1 + 0.5·#same)/n`, kèm ranking win-rate trung bình.
- (Phương án B ±3 và Bradley–Terry để mở rộng sau — xem `proposal.md` §7.)

---

## 5. Service logic (`eval_service.py`)

`EvalService(session_factory, registry)`:

- `next_mos(session_id) -> Trial|None` — chọn tổ hợp ít phiếu, tránh lặp sample gần nhất.
- `submit_mos(trial_id, score, session_id)` — validate + ghi (transaction, khoá `consumed`).
- `next_cmos(session_id)` / `submit_cmos(...)` — tương tự, cặp sort cố định.
- `mos_results()` / `cmos_results()` — tổng hợp.
- Chọn tổ hợp: query đếm phiếu theo `(sample, model)` / cặp, lấy nhóm `min`, random trong nhóm đó (cân bằng phơi nhiễm, không random thuần).

`trial_id`: `secrets.token_urlsafe(16)` (token mờ, không nhúng model).

---

## 6. Pre-generate script (`scripts/pregenerate.py`)

```text
load test_set (≈50 câu) từ file (json/csv) → upsert samples
upsert models từ models.yaml (tts)
for sample, for model:
    wav_b64 = await engine_client.synthesize(sample.text, model)   # tái dùng client
    decode → ghi static/audio/<hash>.wav   (hash che tên model)
    upsert audios(sample_id, model_id, audio_url="/static/audio/<hash>.wav")
```
- Chạy 1 lần (hoặc khi đổi test set). Idempotent qua `UNIQUE(sample_id, model_id)`.
- Hỗ trợ `--mock` để chạy với `MockEngineClient`.

---

## 7. Tích hợp `main.py`

```python
from fastapi.staticfiles import StaticFiles
from app.db import init_db, get_session_factory
from app.services.eval_service import EvalService
from app.routers import tts, asr, eval as eval_router

init_db(settings)                                  # create_all
app.mount("/static", StaticFiles(directory=settings.static_dir), name="static")
app.state.eval_service = EvalService(get_session_factory(settings), registry)
app.include_router(eval_router.router)
```

---

## 8. Test (`tests/test_eval.py`)

- DB tạm in-memory/sqlite file tạm; seed vài samples + audios.
- MOS: `next` trả trial không lộ model_id; `submit` ghi điểm; score ngoài khoảng → 400; submit lại cùng trial → 400 (`consumed`).
- CMOS: `next` trả slot1/slot2; `submit` choice hợp lệ; choice sai → 400.
- `results`: trả đúng mean/win-rate; tôn trọng `min_votes`.
- Cân bằng phơi nhiễm: sau N lần `next`, số phiếu giữa các model xấp xỉ nhau.

---

## 9. Thứ tự thực thi (PR đề xuất)

1. `config.py` + `db.py` + `models_eval.py` (+ deps) — tạo schema, `init_db`.
2. `schemas_eval.py` + `eval_service.py` (chưa nối route) + unit test service.
3. `routers/eval.py` + tích hợp `main.py` + static mount.
4. `scripts/pregenerate.py` + seed test set mẫu (chạy `--mock`).
5. `results` endpoints + test tổng hợp.
6. `.gitignore` cho `static/audio/`, `data/*.db`; cập nhật README chạy script + endpoint.

---

## 10. Ngoài phạm vi (giai đoạn sau)

- Phương án B (CMOS ±3) và Bradley–Terry/Elo.
- Attention-check trials, auth trang admin `results`, rate-limit/spam theo `session_id`.
- Object storage (S3/MinIO) thay thư mục tĩnh khi scale.
