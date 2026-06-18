# Proposal: Web đánh giá chất lượng TTS bằng MOS & CMOS

## 1. Mục tiêu

Một web app cho phép người dùng **đánh giá chất lượng các model TTS** thông qua MOS và CMOS (Comparative Mean Opinion Score).

---

## 2. Giả định

Với mỗi sample → mỗi model đã generate sẵn audio

Dataset dạng:

```text
(sample_id, model_id, audio_url)
```

---

## 3. User Flow

### MOS Flow

```text
User vào tab Evaluation (chế độ MOS)
→ FE gọi GET /api/eval/mos/next?session_id=...
→ nhận { trial_id, sample_id, audio_url }   (KHÔNG có model_id)
→ play audio (bắt buộc nghe hết / nghe tối thiểu trước khi cho chấm)
→ user chấm điểm (0 → 5, step 0.5)
→ POST /api/eval/mos/submit { trial_id, score, session_id }
→ FE tự gọi next → trial kế tiếp
```

---

### CMOS Flow

```text
User ở chế độ CMOS
→ FE gọi GET /api/eval/cmos/next?session_id=...
→ nhận { trial_id, sample_id, slot1_url, slot2_url }   (slot1/slot2 là thứ tự CỐ ĐỊNH của server)
→ FE RANDOM gán slot1/slot2 vào vị trí trái/phải (A/B) hiển thị  ← khử order-bias ở FE
→ play A / B
→ user chọn: "A tốt hơn" | "B tốt hơn" | "Như nhau"
→ FE map lựa chọn trên màn hình về slot gốc:
      chọn = "slot1" | "slot2" | "same"
→ POST /api/eval/cmos/submit { trial_id, choice: slot1|slot2|same, session_id }
→ next pair
```

> **Khử order-bias chuyển sang FE (đơn giản hoá backend):** server luôn trả cặp theo **thứ tự cố định**
> (`slot1`, `slot2` — vd sort theo model id). FE chịu trách nhiệm **xáo trộn vị trí trái/phải** mỗi
> trial rồi **map ngược** lựa chọn của user về `slot1/slot2` trước khi gửi. Nhờ vậy backend luôn nhận
> choice theo cặp có thứ tự chuẩn → **không cần lưu vị trí trình bày, không cần đảo dấu khi tổng hợp**.

---

## 4. UI Design

> **Stack FE hiện tại:** React + Vite + TypeScript, Zustand store (`src/store/*`), component dùng lại
> trong `src/components/shared` (audio-player, primary-button, card, page-header...). Tab mới bám theo
> cùng pattern: thêm `eval-page.tsx`, `eval/eval-content.tsx`, `store/eval-store.ts`,
> `services/eval.service.ts`, `types/eval.types.ts`.

### Tab mới: "TTS Evaluation"

Thêm vào `tab-navigation.tsx` bên cạnh **Text to Speech** và **Automatic Speech Recognition**.
Trong tab có **toggle/sub-tab chọn chế độ: MOS | CMOS**.

---

### 4.1 MOS UI

#### Components
* `AudioPlayer` (dùng lại `shared/audio-player.tsx`) — play/pause, waveform, duration.
* **Score input**: nút radio dạng band `[0] [0.5] [1] ... [5]` (rõ ràng, ít sai hơn slider trên mobile).
* `PrimaryButton` **Submit** — disable cho tới khi (a) đã nghe đủ audio và (b) đã chọn điểm.
* **Next** — chỉ hiện/được phép sau khi submit (tránh bỏ phiếu trống).
* **Progress**: "Đã chấm X câu" + (tuỳ chọn) mục tiêu phiên.

#### Layout
```text
[ MOS | CMOS ]                      ← sub-tab

         [ ► Audio Player + waveform ]

  Chất lượng giọng nói?
  ( ) 0  ( ) 0.5  ( ) 1 ... ( ) 4.5  ( ) 5

              [ Submit ]   [ Next → ]

  Đã chấm: 12
```

---

### 4.2 CMOS UI

#### Components
* 2 × `AudioPlayer` (A bên trái, B bên phải).
* 3 nút chọn: **A tốt hơn** | **Như nhau** | **B tốt hơn** (đặt giữa, cân xứng).
* `PrimaryButton` **Submit** — disable cho tới khi đã nghe **cả hai** audio và đã chọn.
* **Next** sau khi submit.

#### Layout
```text
[ MOS | CMOS ]

   [ ► Audio A ]            [ ► Audio B ]

      ( A tốt hơn )  ( Như nhau )  ( B tốt hơn )

              [ Submit ]   [ Next → ]
```

> A/B chỉ là vị trí hiển thị; FE đã xáo trộn slot1/slot2 vào A/B (xem mục 3). Không nhãn nào lộ model.

---

### 4.3 State & Service (FE)

* `eval-store.ts` (Zustand): `mode` (mos/cmos), `sessionId`, `currentTrial`, `selectedScore`/`choice`,
  `hasListenedFull`, `submitting`, `count`.
* `sessionId`: sinh 1 lần bằng `crypto.randomUUID()`, lưu `localStorage`, gửi kèm mọi request.
* `eval.service.ts`: `getMosNext`, `submitMos`, `getCmosNext`, `submitCmos` (qua `services/api.ts` sẵn có).
* **Random A/B (CMOS) nằm ở store**: khi nhận trial, random `displayOrder = [slot1,slot2]` hoặc
  `[slot2,slot1]`; khi submit map nút đã chọn về slot tương ứng.
* **API base URL** qua env `VITE_API_BASE_URL` (giữ nguyên cấu hình hiện tại).

### 4.4 UI Requirements

* **Không hiển thị**: model name, model_id, slot id, hay bất kỳ metadata sample nào.
* **Audio player**: play/pause, waveform, duration; preload audio kế tiếp để mượt.
* **Ràng buộc chấm hợp lệ**: phải nghe đủ (MOS) / nghe cả hai (CMOS) mới cho submit; chống double-submit.
* **Trạng thái**: loading khi gọi `next`/`submit`, error state (dùng `shared/error-state.tsx`), empty state khi hết trial.
* **Responsive**: CMOS 2 cột trên desktop → xếp dọc trên mobile; band điểm MOS wrap gọn.
* **A11y**: nút chấm điểm/lựa chọn truy cập được bằng bàn phím, có aria-label trung tính (không lộ model).

---

## 5. Backend Design

> **Khác biệt so với backend hiện tại:** backend TTS/ASR đang chạy **không có DB**, lấy model
> từ `models.yaml`, và sinh audio on-the-fly qua `engine_client`. Phần Evaluation cần **lưu điểm**
> nên **bắt buộc thêm DB** (SQLite là đủ cho demo) và một **bước pre-generate** audio cho test set
> cố định. Tất cả endpoint mới gom dưới prefix `/api/eval`, tái dùng FastAPI + `engine_client` sẵn có.

### 5.0 Nguyên tắc thiết kế (rất quan trọng)

1. **Blind / chống lộ thông tin:** client **không bao giờ** được biết `model_id`. Mọi lần lấy
   sample, server cấp một **`trial_id`** (token mờ) ánh xạ tới `(sample, model, vị trí)` ở phía
   server. Khi submit, client chỉ gửi lại `trial_id` + điểm/lựa chọn → chống cả lộ thông tin lẫn giả mạo.
2. **Pre-generate, không gen lúc chấm:** test set cố định (~50 samples × N models) được generate sẵn
   bằng script (gọi `engine_client.synthesize`), lưu file + ghi vào bảng `audios`. Lúc chấm chỉ trả URL tĩnh.
3. **Stateless API + session:** mỗi phiên người dùng có `session_id` (cookie/uuid do client sinh hoặc
   server cấp) để khử trùng lặp, cân bằng phơi nhiễm model và phát hiện spam.

---

### 5.1 API Endpoints

#### `GET /api/eval/mos/next?session_id=...`
Trả 1 trial MOS mới (đã chọn sample + model phía server, đã loại sample vừa nghe).

```json
{
  "trial_id": "t_8f3a...",   // token mờ, KHÔNG chứa model_id
  "sample_id": "s1",
  "audio_url": "/static/audio/s1__m2.wav"
}
```

#### `POST /api/eval/mos/submit`
```json
{
  "trial_id": "t_8f3a...",
  "score": 4.5,              // 0..5, bước 0.5
  "session_id": "sess_..."
}
```
Server tra `trial_id` → `(sample_id, model_id)`, validate `score ∈ {0,0.5,...,5}`, ghi `mos_scores`.

#### `GET /api/eval/cmos/next?session_id=...`
Trả cặp theo **thứ tự cố định** `slot1`/`slot2` (vd sort theo model id). **FE** lo việc xáo trộn
trái/phải (xem mục 3) → backend không cần random vị trí, không cần lưu vị trí trình bày.

```json
{
  "trial_id": "t_c12...",
  "sample_id": "s1",
  "slot1_url": "/static/audio/s1__mX.wav",
  "slot2_url": "/static/audio/s1__mY.wav"
}
```

#### `POST /api/eval/cmos/submit`
`choice` đã được FE map về slot gốc nên backend ghi trực tiếp, không xử lý order-bias.
```json
{
  "trial_id": "t_c12...",
  "choice": "slot1" | "slot2" | "same",   // hoặc thang -3..+3 (xem 7.2)
  "session_id": "sess_..."
}
```

#### `GET /api/eval/mos/results` và `GET /api/eval/cmos/results`
Endpoint kết quả/leaderboard (cho trang admin). Trả ranking + số phiếu + khoảng tin cậy.

---

## 6. Database Design

SQLite + SQLModel/SQLAlchemy. `samples` và `models` có thể seed từ test set; `audios` do script
pre-generate ghi vào.

#### samples
```sql
id           TEXT PRIMARY KEY
text         TEXT NOT NULL
```

#### models
```sql
id           TEXT PRIMARY KEY        -- vd model_a; trùng tên trong models.yaml
name         TEXT
```

#### audios   -- 1 dòng cho mỗi (sample, model) đã pre-generate
```sql
id           INTEGER PK
sample_id    TEXT REFERENCES samples(id)
model_id     TEXT REFERENCES models(id)
audio_url    TEXT NOT NULL
UNIQUE(sample_id, model_id)
```

#### trials   -- ánh xạ token mờ → nội dung thật (cốt lõi cho chống lộ/giả mạo)
```sql
id           TEXT PRIMARY KEY        -- trial_id
kind         TEXT                    -- 'mos' | 'cmos'
session_id   TEXT
sample_id    TEXT
model_id     TEXT                    -- dùng cho MOS
model_slot1  TEXT                    -- model gắn slot1 (CMOS, thứ tự CỐ ĐỊNH)
model_slot2  TEXT                    -- model gắn slot2 (CMOS)
created_at   TIMESTAMP
consumed     BOOLEAN DEFAULT 0       -- chống submit trùng 1 trial
```
> Không lưu "vị trí trình bày trái/phải" vì việc đó do FE xử lý; backend chỉ giữ ánh xạ slot cố định.

#### mos_scores
```sql
id           INTEGER PK
trial_id     TEXT REFERENCES trials(id)
session_id   TEXT
sample_id    TEXT
model_id     TEXT
score        REAL                    -- 0..5
created_at   TIMESTAMP
```

#### cmos_scores
```sql
id           INTEGER PK
trial_id     TEXT REFERENCES trials(id)
session_id   TEXT
sample_id    TEXT
model_slot1  TEXT                    -- cặp theo thứ tự cố định
model_slot2  TEXT
choice       TEXT                    -- 'slot1' | 'slot2' | 'same' (hoặc score -3..+3)
created_at   TIMESTAMP
```

> Vì cặp luôn ở **thứ tự cố định** (slot1 < slot2 theo id) và FE đã map lựa chọn về slot, việc tổng
> hợp chỉ là đếm `choice` theo cặp — **không còn order-bias để xử lý ở backend**. `session_id` vẫn
> dùng để khử trùng lặp/spam và audit.

---

### 6.1 Lưu file WAV thế nào?

**Không nên nhét file wav vào DB.** DB chỉ lưu **đường dẫn/URL**; bytes của audio nằm ngoài DB.

* **Khuyến nghị (demo):** lưu file ra **thư mục tĩnh** (vd `backend/static/audio/s1__model_a.wav`),
  serve bằng `app.mount("/static", StaticFiles(directory="static"))` của FastAPI. Bảng `audios.audio_url`
  chỉ chứa path `/static/audio/...`. Đơn giản, cache tốt, không phình DB.
  * Quy ước tên file mã hoá `(sample_id, model_id)` nhưng **URL không tự lộ tên model một cách dễ đoán**
    cho người dùng thường — hoặc dùng tên file băm (hash) để giữ tính mù chặt hơn.
* **Khi cần đóng gói/portable:** lưu **BLOB trong SQLite** (cột `BLOB`) là khả thi vì file wav test set
  nhỏ và cố định, nhưng đánh đổi: query nặng hơn, khó cache HTTP, khó CDN → chỉ dùng nếu muốn 1 file DB duy nhất.
* **Khi scale/đa instance:** đẩy lên **object storage** (S3/MinIO), `audio_url` là presigned/public URL.

**Pre-generate script** (chạy 1 lần khi có test set):
```text
for sample in test_set (≈50):
  for model in models:
     wav = engine_client.synthesize(sample.text, model)   # tái dùng client sẵn có
     ghi ra static/audio/<hash>.wav
     upsert audios(sample_id, model_id, audio_url)
```
Lúc người dùng chấm chỉ phục vụ file tĩnh → nhanh, ổn định, không phụ thuộc engine lúc runtime.

---

## 7. Metrics Calculation

### 7.1 MOS
```text
MOS(model) = mean(score over tất cả phiếu của model)
```
Báo cáo kèm: số phiếu `n`, độ lệch chuẩn, **95% CI = mean ± 1.96·std/√n**.
Chỉ xếp hạng model có `n ≥ ngưỡng` (vd ≥ 20) để tránh kết luận trên ít phiếu.

### 7.2 CMOS / Preference
Cách A/B/Same hiện tại thực chất là **preference test (win-rate)**, không phải CMOS chuẩn.
Hai lựa chọn:

* **Đơn giản (khuyến nghị cho demo):** preference / win-rate. Vì cặp đã ở thứ tự cố định (slot1, slot2):
  ```text
  win_rate(slot1 vs slot2) = (#choice=slot1 + 0.5·#same) / (#trials của cặp)
  ```
* **Chuẩn CMOS (nếu cần):** dùng thang so sánh −3..+3 ("slot2 tốt hơn slot1 bao nhiêu"),
  `CMOS = mean(score)` với score quy ước theo slot1 làm gốc.

> **Không cần bước chuẩn hoá thứ tự ở backend nữa:** vì cặp luôn lưu theo thứ tự cố định và FE đã
> xáo trộn hiển thị + map lựa chọn về slot, các phiếu không bị triệt tiêu. Đây chính là cái lợi của
> việc đẩy order-bias sang FE.

### 7.3 Ranking
* **MOS:** sort theo MOS desc (kèm CI).
* **CMOS:** lập ma trận `N×N` thắng/thua → quy về 1 thứ hạng bằng:
  * win-rate trung bình (đơn giản), hoặc
  * **Bradley–Terry / Elo** (nâng cao) để ra điểm năng lực mỗi model.

---

## 8. Randomization & Quality Control

Chống bias và dữ liệu rác:

* **Cân bằng phơi nhiễm:** chọn `(sample, model)` / cặp `(A,B)` theo cách ưu tiên những tổ hợp ít
  phiếu nhất, để mọi model nhận số phiếu xấp xỉ nhau (không random thuần).
* **Random vị trí A/B** mỗi trial (chống order-bias) — **do FE đảm nhận**; backend giữ cặp ở thứ tự cố định.
* Không cho nghe lại cùng `sample` liên tiếp; theo dõi qua `session_id`.
* **Attention check (tuỳ chọn):** chèn vài trial "mồi" (audio rõ ràng tốt/xấu) để loại session chấm bừa.
* Khử trùng lặp: mỗi `trial_id` chỉ submit 1 lần (`consumed`), 1 session không chấm lại cùng trial.