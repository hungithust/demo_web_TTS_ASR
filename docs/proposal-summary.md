# Proposal: Web đánh giá chất lượng TTS bằng MOS & CMOS

## 1. Mục tiêu

Một web app cho phép người dùng **đánh giá chất lượng các model TTS** thông qua MOS và CMOS.

---

## 2. User Flow

### MOS Flow

```text
User vào web
→ hệ thống random (sample_id, model_id)
→ play audio
→ user chấm điểm (0 → 5, step 0.5)
→ submit
→ next sample
```

---

### CMOS Flow

```text
User vào web
→ hệ thống random:
   sample_id + 2 model khác nhau
→ play audio A / B
→ user chọn:
   - A better
   - B better
   - Same
→ submit
→ next pair
```

---

## 3. UI Design

### Tab mới: "TTS Evaluation"

Thêm 1 tab bên cạnh:

* Text to Speech
* Automatic Speech Recognition
* **TTS Evaluation (NEW)**

---

### 3.1 MOS UI

#### Components

* Audio Player
* Score Slider (0 → 5, step 0.5)
* Submit Button
* Next Button

#### Layout

```text
[TTS Evaluation - MOS]

[Audio Player]

[Score: 0 0.5 1 ... 5]

[Submit] [Next]
```

---

### 3.2 CMOS UI

#### Components

* Audio Player A
* Audio Player B
* Selection buttons:
  * A better
  * B better
  * Same
* Submit

#### Layout

```text
[TTS Evaluation - CMOS]

[Audio A]   [Audio B]

(A better) (Same) (B better)

[Submit] [Next]
```

---

### 3.3 UI Requirements

* Không hiển thị:
  * model name
  * sample metadata
* Audio player:
  * play/pause
  * waveform
  * duration
* Responsive

---

## 4. Thiết kế backend (API)

| API | Chức năng |
|-----|-----------|
| `GET /api/eval/mos/next` | Trả về một audio cần chấm (kèm mã định danh lượt chấm, không kèm tên model) |
| `POST /api/eval/mos/submit` | Ghi nhận điểm của một lượt chấm MOS |
| `GET /api/eval/cmos/next` | Trả về một cặp audio A/B cần so sánh |
| `POST /api/eval/cmos/submit` | Ghi nhận lựa chọn của một lượt so sánh CMOS |
| `GET /api/eval/{mos,cmos}/results` | Trả về kết quả tổng hợp và xếp hạng model |

Mỗi lượt chấm được gắn một mã định danh ẩn; phía server biết mã này tương ứng với model nào, còn phía giao diện thì không, qua đó giữ được tính ẩn danh model và tránh can thiệp kết quả.

## 5. Cơ sở dữ liệu

Sử dụng SQLite (gọn nhẹ, không cần dựng server CSDL riêng), gồm các bảng chính:

- `samples`, `models`, `audios` — danh mục câu mẫu, model và đường dẫn file audio. File WAV lưu trên ổ đĩa, CSDL chỉ lưu đường dẫn.
- `mos_scores`, `cmos_scores` — lưu từng lượt chấm.

## 6. Cách tổng hợp và tính điểm

**MOS** — điểm trung bình của mỗi model trên toàn bộ lượt chấm, sau đó xếp hạng từ cao xuống thấp.

```
MOS(model) = trung bình các điểm đã chấm cho model
```

**CMOS** — đề xuất hai phương án, lựa chọn tùy mức độ chi tiết mong muốn:

- **Phương án A — Tỷ lệ thắng (đơn giản):** dựa trên các lựa chọn A tốt hơn / Như nhau / B tốt hơn.
  ```
  win_rate = (số lần được chọn tốt hơn + 0.5 × số lần "như nhau") / tổng số lượt
  ```
- **Phương án B — Thang điểm ±3 (chuẩn CMOS):** người nghe chấm mức độ "B tốt hơn A bao nhiêu" trên thang −3…+3, rồi lấy trung bình.

Đề xuất triển khai Phương án A trước cho nhanh gọn, mở rộng sang Phương án B khi cần đo mức độ chênh lệch giữa các model.

## 7. Đảm bảo độ tin cậy của kết quả

- Random thứ tự câu mẫu và cặp model để giảm thiên lệch.
- Với CMOS, vị trí trái/phải (A/B) được hoán đổi ngẫu nhiên nhằm tránh thiên lệch theo vị trí.
- Phân bổ số lượt chấm tương đối đồng đều giữa các model.
