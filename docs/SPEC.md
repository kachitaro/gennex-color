# SPEC — Color system (Phase 0: nghiên cứu & đặc tả)

- Trạng thái: **draft, chờ chốt quyết định (§10)**. Chưa có code sản phẩm; chưa cài dependency vào repo.
- Ngày: 2026-11-04. Tên package/repo: chưa chốt (thư mục hiện tại `gennex-color`).
- Mọi con số trong tài liệu này do tôi đo bằng script throwaway ở `/tmp/probe` (không nằm trong repo) từ dữ liệu thật của `@radix-ui/colors@3.0.0`, `tailwindcss@4.3.4`, devglow `5c131e1`, `culori@4.0.2`. Cách tái lập: Phụ lục A. Điều gì **không** đo/đọc được: §1.2 và §11.

---

## 1. Nguồn đã đọc

### 1.1 Bảng nguồn

| Nguồn | Đã đọc | Phiên bản / mốc |
|---|---|---|
| Radix Colors docs | `overview/installation`, `usage`, `aliasing`, `custom-palettes`, `releases`; `palette-composition/understanding-the-scale`, `composing-a-palette`, `scales`; trang tool `/colors/custom` (chỉ UI) | Docs ghi "Current version `3.0.0`". `releases`: 3.0.0 = "complete rework of all colors" + thêm P3 (ngày ghi trên trang: 2 Oct 2023). npm `@radix-ui/colors@3.0.0` (MIT, `time.modified` 2025-12-24). Đã cài và đọc cả 254 export (light / dark / alpha / P3). |
| shadcn/ui theming | `ui.shadcn.com/docs/theming` (đủ 495 dòng), `/docs/tailwind-v4` (dòng 1–300/424, phần còn lại là bước nâng dependency), `/docs/dark-mode` (chỉ trang chỉ mục) | Docs không ghi số phiên bản; fetch 2026-11-04. CLI `shadcn@4.23.0` (npm, 2026-10-27). `components.json` mẫu: `style: base-nova`, `baseColor: neutral`. |
| Tailwind CSS | `tailwindcss.com/docs/theme` (namespace `--color-*`, option `inline`), file `theme.css` trong package | `tailwindcss@4.3.4` (npm, 2026-11-02) |
| devglow | `README.md`, `colors/`, `lua/devglow/{palettes/*.lua, oklch.lua, derive.lua, contrast.lua, highlights.lua}`, `docs/superpowers/specs/2026-07-19-light-mode-design.md`, `CHANGELOG.md`, `LICENSE` | commit `5c131e1ec…` (2026-07-19), MIT © 2025 Phat Nguyen. 23 commit, **không có git tag**, 12 palette nằm trong mục `[Unreleased]` của CHANGELOG. |

### 1.2 Chưa đọc được / giới hạn

- Thuật toán của Radix "custom palette tool": trang là client UI; docs chỉ nói scale sinh ra "based on the Radix Colors scales themselves". Tôi **không** đọc source của nó. Thuật toán ở §4 là của tôi, đối chiếu với dữ liệu Radix đã đo.
- Radix không có trang docs riêng về alpha (URL `overview/dark-mode` trả 404). Hiểu biết về alpha lấy từ `custom-palettes`, `scales` và các file `*-alpha.css` trong package.
- shadcn `/docs/dark-mode/*` (từng framework) chưa đọc; cơ chế `.dark` + `@custom-variant dark (&:is(.dark *))` lấy từ khối CSS mặc định trong `/docs/theming`.
- Chưa kiểm tra trên trình duyệt thật: hành vi gamut-mapping của `oklch()` ngoài sRGB, hiển thị P3.

---

## 2. Phát hiện chính (số đo, không phải trí nhớ)

### 2.1 Radix Colors 3.0.0 (25 scale chromatic, giá trị sRGB hex)

| Phát hiện | Số liệu | Hệ quả |
|---|---|---|
| Step 9 giống hệt giữa light và dark | cả 25 scale | Dark mode của Radix không đổi "solid"; đổi step 1–8, 10–12 |
| Chữ trắng trên step 9 đạt AA (≥4.5) | **5/25** (plum, purple, violet, iris, indigo). Chữ đen: 20/25. blue 3.26, teal 3.07, green 3.16, cyan 3.00, orange 2.97 | Docs nói "most step 9 designed for white text" nhưng đa số **không** đạt WCAG AA → `primary-foreground` cố định = trắng là sai |
| Step 11 (text) trên step 3, light | **10/25** < 4.5 (min 3.99, orange). Step 11 trên step 2: min 4.25 (orange). Dark: tất cả ≥ 7.08 | Radix bảo đảm APCA Lc 60/90 trên step 2, **không** phải WCAG 4.5 |
| Khoảng cách hue giữa các scale | 22 scale chromatic (không tính brown/bronze/gold): min **3.9°** (sky/cyan), 4° (mint/teal); min ΔE_OK(step 9) = **0.023** (jade/teal) | Radix tách cụm bằng lightness/chroma chứ không bằng hue → chính là lỗi "hue dồn cụm" ta phải tránh |
| Step 9 so với biên gamut sRGB | C9 = 62–100% chroma tối đa sRGB tại L9; blue/cyan/teal/yellow/amber = ~100% (đã bị clamp; bản P3 mới có thêm chroma) | Gamut mapping là phần của thiết kế, không phải hậu xử lý |
| Hue drift trong scale | Median 0°, nhưng warm (orange/amber/yellow/brown) trôi tới ±30–80°/đơn vị L, blue/sky ngược chiều | Đo lợi ích khi thêm drift vào bộ sinh: ΔE_OK giảm ≤ 0.005 (dưới JND) → **không dùng drift** (§4.5) |

### 2.2 shadcn/ui (docs theming, hôm nay)

- Token màu: `background/foreground`, `card(+fg)`, `popover(+fg)`, `primary(+fg)`, `secondary(+fg)`, `muted(+fg)`, `accent(+fg)`, `destructive` (**không có `-foreground`**), `border`, `input`, `ring`, `chart-1..5`, `sidebar`, `sidebar-foreground`, `sidebar-primary(+fg)`, `sidebar-accent(+fg)`, `sidebar-border`, `sidebar-ring`; không màu: `radius` (+ `radius-sm…4xl` dẫn xuất).
- Quy ước: `X` là surface, `X-foreground` là chữ/icon trên surface (bỏ hậu tố `-background`).
- Không có `success/warning/info`; docs hướng dẫn thêm bằng `:root`/`.dark` + `@theme inline { --color-warning: var(--warning) }`.
- Dark mode = ghi đè cùng token trong `.dark`; mặc định border dark = `oklch(1 0 0 / 10%)`, input = `/ 15%`.
- Tailwind v4: giá trị token là `oklch(...)` thẳng trong `:root`/`.dark`, map qua `@theme inline`. Tailwind docs: `inline` làm utility dùng **giá trị** biến thay vì tham chiếu biến theme → ghi đè `--primary` lúc runtime vẫn có hiệu lực qua `var(--primary)`.
- Audit bộ giá trị neutral mặc định trong docs (WCAG 2.x):

| Cặp | Tỉ lệ | Chuẩn |
|---|---|---|
| light `muted-foreground` trên `muted` (0.556 / 0.97) | 4.34 | 4.5 ✗ |
| light `input`/`border` trên `background` (0.922 / 1) | 1.26 | 3 (1.4.11 cho ô input) ✗ |
| light `ring` trên `background` (0.708 / 1) | 2.59 | 3 ✗ |
| dark `border` 10% / `input` 15% trên `background` | 1.25 / 1.47 | 3 (input) ✗ |
| dark chữ trắng trên `destructive` (0.704 …; docs không định nghĩa foreground, giả định trắng) | 2.87 | 4.5 ✗ |

→ Ta **không** kế thừa số của shadcn; chỉ kế thừa **tên token và quy ước cặp**.

### 2.3 devglow (12 palette, 17 key)

- 17 key = `FOREGROUND`, `BACKGROUND`, 10 accent (`RED GREEN BLUE ORANGE YELLOW PINK GOLD TEAL SKY WINE`), 5 shade `DARK_00..04` (xác nhận cả 12 file đều đủ 17 key).
- **Tên key là vai trò, không phải hue.** Hue OKLCH đo được: `GREEN` 61°–196°, `BLUE` 176°–277°, `YELLOW` 73°–175°, `PINK` 0°–358°. Ember: `GREEN`, `BLUE`, `TEAL`, `SKY` đều ≈196°. Vesper: `GREEN`, `ORANGE`, `GOLD` đều ≈61°.
- Chroma thấp: accent chủ yếu C 0.02–0.16; L 0.58–0.93. Đây là "màu im lặng" của devglow.
- Chạy 120 accent (12 palette × 10): **106/120** < 4.5 với chữ trắng (và ngược lại làm nền nút); **14/120** < 4.5 trên chính nền của palette (dark); `DARK_04` (chữ comment/muted) < 4.5 trên `BACKGROUND` ở **11/12** palette (2.85–4.24; chỉ Sage 4.60); `DARK_03` (viền/selection) trên `BACKGROUND` chỉ 1.53–1.71 (non-text 3:1 ✗ cả 12).
- Light mode của devglow (`derive.lua`): OKLCH, giữ hue, bisection L xuống tới AA 4.5, clamp chroma vào gamut, bước "mutual distinctness" — cùng tinh thần thuật toán của ta. Dark không được kiểm AA (chỉ light có `:DevglowAudit` gate).
- README ghi Sage "grey-tinted" nhưng dữ liệu: `BACKGROUND` và `DARK_00..04` của Sage có C = 0 (xám thuần). Màu "ấm/lạnh" của palette nằm ở accent, không ở neutral.

---

## 3. Mô hình token 3 lớp

```
L1 Primitive   hue-1…12 (+ -contrast), neutral-1…12, alpha   ← sinh bởi thuật toán (§4), theo mode
      ▲  (var(--x) reference, không copy giá trị)
L2 Semantic    tên shadcn + mở rộng                         ← bảng ánh xạ bậc → token (§3.3), theo mode
      ▲
L3 Theme       {seed hue | preset, neutral, canvas, κ, radius} × {light, dark} ← cấu hình, đầu vào của slider
```

### 3.1 L1 — Primitive

- Mỗi hue (12 hue lõi, §5) × mode: `--{hue}-1 … --{hue}-12` và `--{hue}-contrast` (foreground cho step 9/10 của riêng hue đó, §3.2).
- Neutral: 3 ramp `cool | neutral | warm` × `-1…-12`; alias runtime `--neutral-N` trỏ ramp đang chọn (mutable alias, đúng mô hình Radix `aliasing`).
- Alias seed: `--accent-N` / `--accent-contrast` trỏ hue đang chọn. Slider demo chỉ ghi đè nhóm này (24 biến/mode, §4.6).
- Alpha: `--white-a1…12`, `--black-a1…12`, `--{neutral}-a1…12` (bản alpha của neutral được tính để composite lên N1 ra đúng step đặc). Alpha theo hue: **tính theo yêu cầu bằng hàm**, không phát ra mặc định (D6). Chú ý (từ docs Radix `custom-palettes`): alpha trộn khác nhau giữa sRGB và P3 → bản P3 phải tính lại, không suy từ bản sRGB.
- Tailwind: tắt palette mặc định (`--color-*: initial`, theo Tailwind docs "override namespace") để `bg-blue-9` chỉ ra màu của ta; expose primitive bằng `@theme inline { --color-blue-9: var(--blue-9); … }` (sinh tự động).

### 3.2 `primitive-foreground` tính theo từng hue

Không có "trắng cố định". Với mỗi hue × mode, chọn foreground là **ứng viên đầu tiên** trong `[trắng pha hue, đen pha hue, trắng thuần, đen thuần]` thỏa `min(CR(fg, step9), CR(fg, step10)) ≥ 4.55`:

- trắng pha hue = `oklch(0.985 0.012 h)`, đen pha hue = `oklch(0.20 0.03 h)`;
- ngưỡng solve 4.55 (đệm 0.05 cho làm tròn 8-bit); test sàn 4.5.
- Bất biến: max(CR trắng thuần, CR đen thuần) ≥ 4.58 với **mọi** màu, nên luôn tồn tại lời giải; "vùng chết" là L9 ≈ 0.58–0.62, nơi chỉ bản **thuần** đạt (§4.4, mục mở O1).
- Kết quả đo cho 12 hue lõi (light, hex 8-bit): trắng cho red (tint, 4.77), blue (rơi về trắng thuần, 4.7), violet 5.2, magenta 4.9, pink 4.8; đen pha hue cho orange 6.5, green 7.7, teal 7.7, cyan 8.2, lime 11.2, amber 9.6, yellow 12.3. So Radix: chữ trắng trên blue9 = 3.26 → ta 4.7 bằng cách hạ L9, không phải bằng cách đổi sang đen cho blue.

### 3.3 L2 — Semantic: bảng ánh xạ bậc → token

Ký hiệu: `N` = neutral đang chọn, `A` = hue chính (seed), `R/G/Y/B` = red/green/amber/blue (hue trạng thái, cấu hình được). `Nn` = bậc n. Cột "Rule" trỏ tới test §6.

**Lưu ý đặt tên**: shadcn `accent` = surface tương tác (hover/selected), KHÔNG phải brand như `accent` của Radix Themes. Trong tài liệu này "hue chính" = brand seed = `primary`; shadcn `accent` giữ nghĩa shadcn.

| Token | Light | Dark | Rule |
|---|---|---|---|
| `background` | N1 | N1 (dịch theo `canvas`, §3.4) | T1 |
| `foreground` | N12 | N12 | T1 ≥ 7 |
| `card` / `card-foreground` | N1 / N12 | **N2** / N12 | T1, T6 |
| `popover` / `popover-foreground` | N1 / N12 | **N2** / N12 | T1, T6 |
| `primary` | A9, **nhưng** dịch L khỏi A9 (tối hơn ở light, sáng hơn ở dark) đúng mức cần để đọc được như chữ (O9, mục 12) | idem | T1, T7 |
| `primary-foreground` | foreground giải theo từng hue cho `primary`, hover và `primary/80` trên bề mặt | idem | T1, T7 |
| `primary-hover` *(mở rộng)* | A10; khi `primary` đã dịch thì L ± 0.03 xa pivot hơn | idem | T1, T4 |
| `primary-text` *(mở rộng)* | `accessible`: = `primary`. `vivid`: bậc/L sáng nhất của brand vẫn ≥ 4.5 làm chữ trên background, card, popover, muted, sidebar và `muted/50` | idem | T7 |
| `secondary` / `-foreground` | N3 / N12 | N3 / N12 | T1 |
| `muted` / `muted-foreground` | N3 / **N11** | N3 / **N11** | T1 ≥ 4.5 trên background, card, popover, muted, secondary, accent |
| `accent` / `accent-foreground` | N4 / N12 | N4 / N12 | T1 |
| `destructive` | R9, dịch L như `primary` (đọc được như chữ trên bề mặt, trên nền tint `destructive/10…30` và chữ `/80…/90`) | idem | T1, T7 |
| `destructive-foreground` *(thêm, shadcn không có)* | foreground giải theo hue cho `destructive` | idem | T1 |
| `border` | N6 | N6 | T3 (trang trí, chỉ kiểm ≥ 1.2:1) |
| `input` | **solved**: neutral sáng nhất (dark: tối nhất) vẫn ≥ 3:1 trên mọi bề mặt nó nằm (`neutralBorder`, mục tiêu 3.05). Mặc định bề mặt = background và card: light `[N1]`, dark `[N1, N2]`. Đo: neutral light L 0.658 (3.07:1; N9 là 0.643 / 3.24:1), dark L 0.509 (3.30:1 trên N1; N8/N9 là 3.00–3.70) | idem, tính lại theo mode | T3 (D4) |
| `ring` | bậc A đầu tiên trong `[9,10,11]` ≥ 3:1 trên background và card | idem | T3 |
| `chart-1…5` | 5 hue lõi chọn bằng greedy max-min ΔE (loại hue chính); L ép xuống/lên đến ≥ 3:1 trên `card` | idem, theo mode | T3, H |
| `sidebar` / `-foreground` | N2 / N12 | N2 / N12 | T1 |
| `sidebar-primary` / `-foreground` | A9 / `A-contrast` | A9 / `A-contrast` | T1 |
| `sidebar-accent` / `-foreground` | N4 / N12 | N4 / N12 | T1 |
| `sidebar-border` / `sidebar-ring` | N6 / `ring` | N6 / `ring` | T3 |
| `radius` | `0.625rem` (shadcn default), scalar | — | — |
| **Trạng thái** `success` (G), `warning` (Y), `info` (B) *(mở rộng, D7)* | `X`=9, `X-foreground`=contrast, `X-subtle`=3, `X-text`=11, `X-border`=7 | idem (bảng L dark) | T1, T2 |
| `destructive-subtle/-text/-border` | R3 / R11 / R7 | idem | T2 |

Nguyên tắc: **cùng một bảng ánh xạ**, khác biệt dark nằm ở (a) giá trị primitive từ bảng L/C dark riêng (§4.2), (b) các hàng in đậm (elevation `card/popover`, `input`/`ring` tính lại, `X-text` dùng step 11 của dark), (c) `canvas`. Nguồn gốc quy ước: Radix `aliasing` ("mutable aliases": panel = white ở light, `slate-2` ở dark; nhiều alias trỏ cùng một step khi cần).

**Tuỳ chọn theme `pageStep: 2` ("page = s2")**: mặc định page = N1 (card = N1 ở light, N2 ở dark). Với `pageStep: 2`: `background` = N2; `card`/`popover` = N1 ở light (card sáng hơn nền) và N3 ở dark. `input` và `ring` được tính lại cho cặp bề mặt mới.

Giới hạn của viền input: 3:1 trên nền gần trắng buộc L ≤ ~0.66, nên "nhẹ hơn" chỉ được thêm ~0.015 L ở light (0.643 → 0.658); dark nhẹ hơn nhiều (3.70 → 3.30). Muốn viền nhẹ hơn nữa phải bỏ 3:1 (D4 "mềm", dựa vào label/nền ô nhập để nhận diện theo WCAG 1.4.11) — chưa cài, cần bạn chốt.

**Đã cài (Phase 3, `src/theme.ts`)**: `buildTheme({ hue, kappa?, neutral?, status?, pageStep? })`. 18 token shadcn (background, foreground, card, card-foreground, popover, popover-foreground, primary, primary-foreground, primary-hover, secondary, secondary-foreground, muted, muted-foreground, accent, accent-foreground, border, input, ring) + 4 trạng thái × 5 token (destructive, success, warning, info × {X, -foreground, -subtle, -text, -border}) = 38 token mỗi mode, mặc định hue trạng thái red 25 / green 156 / amber 80 / blue 255. Brand = seed tuỳ ý (không cần thuộc bộ lõi). Preview có chỉnh theme: `docs/preview/theme.html` (bundle iife `gennex-color.js` sinh bởi `scripts/preview-theme.ts`).

### 3.4 L3 — Theme

```
Theme = {
  seed:      hue 0–360 | tên hue lõi | id preset,
  neutral:   'cool' | 'neutral' | 'warm' | 'auto' | { hue, chroma },   // D5
  canvasDark: L của background dark, mặc định 0.178 (= Radix gray step 1),
  kappa:     độ rực chroma 0.35–0.85, mặc định 0.85,
  status:    { destructive:'red', success:'green', warning:'amber', info:'blue' },
  radius:    '0.625rem'
}
```
`canvasDark` dịch L của step 1–8 dark neutral theo `canvasDark − 0.178`, giữ nguyên ΔL giữa các bậc; step 11–12 (chữ) không dịch. Dùng cho preset devglow (canvas 0.134–0.187).

Seed của brand/theme là **hue tuỳ ý 0–360°** (ví dụ coral 40°, carrot 64°); không cần nằm trong bộ lõi. Bộ lõi chỉ dùng cho hue trạng thái, chart và các test H1/H2. Mọi seed tuỳ ý vẫn được bảo đảm A3–A6 và T4 (quét mọi hue, §6); `nameOfHue` chỉ cấp nhãn.

Output build: một file CSS (`:root` light + `.dark`), dạng `--token: oklch(L C h)`; khối `@media (color-gamut: p3)` ghi đè primitive bằng bản chroma P3 (cùng cấu trúc Radix: sRGB mặc định + P3 trong `@supports (color: color(display-p3 1 1 1))` / `@media (color-gamut: p3)`); và `@theme inline { --color-<token>: var(--<token>) }` cho Tailwind v4.

---

## 4. Thuật toán sinh scale trong OKLCH

### 4.1 Đầu vào / đầu ra

`generateScale({ hue, kappa=0.85, mode: 'light'|'dark', gamut: 'srgb'|'p3' }) → { steps[1..12]: {L,C,h}, contrast: {L,C,h}, fgMode: 'light-fg'|'dark-fg' }`. Hàm thuần, deterministic, không I/O.

### 4.2 Đường lightness / chroma theo bậc

Bảng dưới là **median của 25 scale Radix** (đo), dùng làm đường nền cho scale chromatic. Neutral dùng L chính xác của Radix `gray` (§5.2).

| Bậc | L light | C/C9 light | L dark | C/C9 dark |
|---|---|---|---|---|
| 1 | 0.994 | 0.02 | 0.188 | 0.09 |
| 2 | 0.982 | 0.07 | 0.211 | 0.13 |
| 3 | 0.959 | 0.16 | 0.267 | 0.31 |
| 4 | 0.932 | 0.26 | 0.309 | 0.46 |
| 5 | 0.900 | 0.36 | 0.345 | 0.50 |
| 6 | 0.859 | 0.48 | 0.389 | 0.53 |
| 7 | 0.806 | 0.63 | 0.452 | 0.59 |
| 8 | 0.734 | 0.75 | 0.537 | 0.72 |
| 9 | **L9(h)** | 1 | **L9(h)** | 1 |
| 10 | L9 + δ | ≈0.99 | L9 + δ | ≈0.95 |
| 11 | 0.544 → giải | 0.90 | 0.785 → giải | 0.82 |
| 12 | 0.332 → giải | 0.45 | 0.911 → giải | 0.29 |

Dark **không phải** đảo light: chroma ratio ở bậc 1–5 cao gấp ~1.4–4.5 lần (0.09 vs 0.02 ở bậc 1; 0.31 vs 0.16 ở bậc 3; 0.50 vs 0.36 ở bậc 5), L bậc 1–8 tăng dần từ 0.19, bậc 11–12 là chữ sáng.

### 4.3 Công thức

1. `La(h)` = nội suy smoothstep vòng tròn giữa 12 neo `(hue, L9)` ở §5.1.
2. `C9 = κ · Cmax(L9, h, gamut)`, `Cmax` = chroma lớn nhất còn trong gamut tại (L, h) (bisection 22 vòng; có thể thay bằng hàm giải tích kiểu Ottosson nếu cần nhanh).
3. `L10 = L9 + δ(L9)`, `δ = −0.03 + 0.06·smoothstep((L9 − 0.58)/0.08)` (hover tối hơn cho hue chữ trắng, sáng hơn cho hue chữ đen; chuyển mượt, không nhảy khi seed quét qua ngưỡng).
4. Bậc 1–8, 10: `C = min(ratio · C9, 0.98 · Cmax(L, h))`.
5. Bậc 11: bắt đầu từ L bảng, bước 0.003 về phía cực chữ (tối ở light, sáng ở dark) tới khi `CR(s11, s1..s3) ≥ 4.55`. Bậc 12: tương tự tới `CR ≥ 7.1`.
6. Foreground: §3.2.
7. **Gamut mapping**: giảm chroma ở L và h không đổi (L quyết định contrast nên giữ nguyên). Không clip kênh RGB. Phát hai bản: chroma tối đa sRGB (mặc định) và P3 (trong `@media (color-gamut: p3)`).
8. Định dạng: `oklch(L C h)` — L 3 chữ số, C 3, h 1.

### 4.4 Gamut: sRGB vs P3, và contrast

- WCAG định nghĩa trên sRGB. Test contrast chạy trên **giá trị sRGB đã làm tròn 8-bit** (sàn 4.5) và trên bản P3 với Y tính từ XYZ (D65). Prototype: cùng (L, h), chroma P3 làm CR của step 9 so với foreground lệch tới **±0.21** (mean 0.07) → không được giả định bản P3 tự đạt AA; phải test riêng, và re-solve L nếu rớt.
- Chroma tăng nhờ P3 ở step 9 (κ=0.85): hue 150° 0.173 → 0.241, hue 180° 0.111 → 0.151, hue 270° 0.208 → 0.223 (blue/violet đã gần biên sRGB nên tăng ít).
- [INFERENCE] Trình duyệt hiển thị `oklch()` ngoài sRGB trên màn sRGB bằng cơ chế riêng; vì vậy phát hai bản (sRGB-an-toàn mặc định + P3 có điều kiện) thay vì một giá trị chroma lớn. Cần xác minh trên Chrome/Safari/Firefox ở Phase 1.

### 4.5 Hue drift: không dùng (đã đo)

Hồi quy độ dốc `Δh = s·(L − L9)` theo từng scale Radix cho kết quả có ý nghĩa ở light (orange +83°, amber +75°, yellow +51°, sky −48°, cyan −40°, blue −37° mỗi đơn vị L) nhưng dark không nhất quán. Áp drift tốt nhất từng scale vào bộ sinh: ΔE_OK trung bình so Radix giảm ≤ 0.005 (orange 0.033→0.028, amber 0.045→0.042, yellow 0.049→0.045; cool/others ≤0.004). Dưới JND (~0.02), phức tạp thêm; **quyết định: hue không đổi trong scale**. Rủi ro: step 11–12 của yellow/amber ra màu ô-liu thay vì nâu (Radix/Tailwind đều trôi về cam ở bậc tối). Mục mở O2: duyệt mắt; nếu xấu, thêm bảng drift thưa cho hue 40–110°.

### 4.6 Hiệu năng cho slider

Prototype không tối ưu (Node 22): **0.13 ms / scale / mode** (≈0.5 ms mỗi lần kéo slider cho 2 mode × accent + neutral auto). Ngân sách 16 ms/frame còn dư nhiều. Slider ghi 12 biến `--accent-N` + `--accent-contrast` (+ neutral nếu `auto`) bằng `style.setProperty` trên `:root`.

### 4.7 So sánh với Radix 3.0.0

Sinh scale tại **đúng hue của step 9 Radix** để cô lập đường cong (ΔE_OK là khoảng cách Euclid OKLab; JND ≈ 0.02):

| Hue của ta ← scale Radix | ΔE_OK trung bình bậc 1–8, 11–12 (light / dark) | ΔE_OK step 9 | L9 ta / Radix | Chữ trên step 9: Radix (tốt nhất trắng/đen) → ta (min trên s9 và s10) |
|---|---|---|---|---|
| red ← red | 0.015 / 0.014 | 0.061 | 0.56 / 0.63 | 5.4 (trắng 3.9) → 4.8 trắng |
| orange ← orange | 0.029 / 0.016 | 0.029 | 0.68 / 0.69 | 7.1 (trắng 3.0) → 5.9 đen |
| amber ← amber | 0.046 / 0.023 | 0.052 | 0.80 / 0.85 | 13.3 → 9.8 |
| yellow ← yellow | 0.050 / 0.027 | 0.063 | 0.86 / 0.92 | 16.6 → 12.0 |
| lime ← lime | 0.016 / 0.033 | 0.051 | 0.84 / 0.89 | 15.6 → 11.4 |
| green ← green | 0.009 / 0.019 | 0.080 | 0.72 / 0.64 | 6.7 (trắng 3.2) → 7.7 đen |
| teal ← teal | 0.012 / 0.020 | 0.071 | 0.72 / 0.65 | 6.8 (trắng 3.1) → 7.6 đen |
| cyan ← cyan | 0.014 / 0.019 | 0.064 | 0.72 / 0.66 | 7.0 (trắng 3.0) → 7.6 đen |
| blue ← blue | 0.015 / 0.029 | 0.100 | 0.56 / 0.65 | 6.4 (trắng 3.3) → 4.6 trắng |
| violet ← violet | 0.015 / 0.016 | 0.048 | 0.55 / 0.54 | 5.4 trắng → 5.1 trắng |
| magenta ← plum | 0.025 / 0.019 | 0.042 | 0.56 / 0.58 | 4.8 trắng → 5.0 trắng |
| pink ← pink | 0.022 / 0.009 | 0.052 | 0.56 / 0.62 | 5.1 (trắng 4.1) → 4.9 trắng |
| **trung bình** | **0.022 / 0.020** | | | |

Đọc kết quả: bậc 1–8, 11–12 sát Radix ở mức ~JND (worst: yellow/amber 0.045–0.05 do hue drift và chroma). Khác biệt có chủ đích nằm ở step 9: blue tối hơn (ΔE 0.10), green/teal/cyan sáng hơn Radix (L 0.72 vs 0.64–0.66) vì chuyển sang chữ đen thay vì chữ trắng 3.0–3.3:1.

### 4.8 Chỗ ta lệch Radix có chủ đích

| Radix | Ta | Lý do |
|---|---|---|
| Step 9 giống nhau light/dark | Cùng L9 nhưng `-contrast` và s10 tính lại theo mode | s10 phải giữ AA với foreground |
| Hover dark = sáng hơn cho mọi hue | Hướng s10 theo hue (δ liên tục) | AA của `primary-foreground` trên hover |
| Text guarantee APCA Lc 60/90 trên step 2 | WCAG 4.5 (s11) / 7 (s12) trên step 1, 2, 3 | Yêu cầu AA; `text-X` trên badge nền step 3 |
| 10/25 scale s11 < 4.5 trên s3 (light) | 0 theo ràng buộc | — |
| Không phụ thuộc seed | Seed liên tục theo hue | Cần cho slider |

---

## 5. Bộ hue và neutral

### 5.1 12 hue lõi (OKLCH hue)

Neo `L9` đặt tay (Radix-like, sau khi kiểm AA); cột tham chiếu lấy từ `theme.css` của Tailwind 4.3.4 (bậc 500) và step 9 của Radix 3.0.0 — dùng để kiểm "tên khớp góc hue thật".

| Tên | h | L9 | chữ trên s9 | Tailwind v4 (500) | Radix (step 9) |
|---|---|---|---|---|---|
| red | 25 | 0.565 | trắng | red 25.3 | red 23 |
| orange | 52 | 0.70 | đen | orange 47.6 | orange 45 |
| amber | 80 | 0.80 | đen | amber 70.1 | amber 84 |
| yellow | 106 | 0.87 | đen | yellow 86.0 | yellow 101 |
| lime | 133 | 0.83 | đen | lime 130.9 | lime 126 |
| green | 156 | 0.72 | đen | green 149.6 | green 158 |
| teal | 184 | 0.72 | đen | teal 182.5 | teal 182 |
| cyan | 214 | 0.74 | đen | cyan 215.2 | cyan 222 |
| blue | 255 | 0.56 | trắng | blue 259.8 | blue 252 |
| violet | 292 | 0.55 | trắng | violet 292.7 | violet 288 |
| magenta | 325 | 0.565 | trắng | fuchsia 322.2 | plum 322 |
| pink | 355 | 0.565 | trắng | pink 354.3 | pink 346 |

Đo trên bộ này (light, step 9):

- Khoảng cách hue min **23°** (lime/green); ΔE_OK(step 9) min **0.060** (teal/cyan), kế tiếp green/teal 0.073, amber/yellow 0.098. So Radix: 3.9° và 0.023.
- Chọn **12**, không phải 14. Thêm `sky` 237° và `indigo` 275° làm khoảng cách hue min tụt còn **17°** (indigo/violet) và sky/blue 18°. Tailwind và Radix đều có hai hue này; nếu cần, đưa vào bộ "mở rộng" tùy chọn (D1).
- Độ phân biệt dưới CVD (mô phỏng full severity, culori): ΔE_OK min giữa 12 step 9 = **0.019** (deutan, amber/lime), **0.012** (protan, yellow/lime), **0.015** (tritan, green/teal). Kết luận: hue một mình không mang nghĩa trạng thái; áp WCAG 1.4.1 (icon/chữ kèm màu) — ghi trong docs, **không** thành test (D-minor).
- Hue lân cận trong 360° trống: lớn nhất cyan→blue 41° và blue→violet 37°. Radix lấp vùng 218–306° bằng 7 scale dày (sky, cyan, blue, indigo, iris, violet, purple). Với 12 hue lõi vùng này thưa hơn; nếu thiếu, dùng bộ mở rộng (D1).

### 5.2 Ba ramp neutral

L lấy chính xác từ Radix `gray` (C=0), do `slate/sand` lệch < 0.003:

- Light: `0.991 0.982 0.955 0.931 0.907 0.885 0.851 0.792 0.643 0.610 0.503 0.244`
- Dark: `0.178 0.213 0.252 0.285 0.313 0.348 0.402 0.489 0.538 0.583 0.770 0.949`

Pha màu: `C_n = C9neutral · p_n` với `p` = trung bình profile của `slate/mauve/sand` Radix tại bậc 1,2,3,6,9,11,12 = `0.09, 0.15, 0.26, 0.54, 1.00, 0.84, 0.70` (nội suy tuyến tính các bậc còn lại).

| Ramp | h | C tại bậc 9 | Tham chiếu |
|---|---|---|---|
| `cool` | 255° | 0.016 | Radix slate (C 0.016, h 248–286); Tailwind slate 257.4, mist 213.5 |
| `neutral` | — | 0 | Radix gray; shadcn `neutral` |
| `warm` | 68° | 0.014 (profile phẳng hơn, s1 C ≈ 0.006) | step 1 light `oklch(0.975 0.006 68)` (`canvas.light` = 0.975, giấy ấm); Radix sand (h 106, C 0.010), Tailwind stone 58, taupe 43 — **số này là chọn của tôi**, duyệt bằng mắt |

Ràng buộc đo được trên `gray` (light/dark): N11 trên N1…N4 = 5.77 / 5.62 / 5.19 / 4.83 (light), 9.11 / 8.48 / 7.67 / 6.92 (dark) → `muted-foreground` = N11 đạt 4.5 trên background, card, muted, accent; **N5 (pressed) rớt**: N11 trên N5 = 4.48 (light) → chữ trên trạng thái pressed dùng N12. N9 trên N1 = 3.24 (light), N8 trên N1 = 3.00 (dark) → `input` cần bậc tính lại và đệm.

Tên ramp tránh trùng tên Radix (slate/sand…) để khỏi nhầm giá trị khác nhau cùng tên.

Cài đặt (`src/neutral.ts`): L lấy bảng Radix `gray` làm tròn 3 chữ số, chroma = `chroma_ramp · p_n` với `p` = 0.09, 0.15, 0.26, 0.353, 0.447, 0.54, 0.693, 0.847, 1, 0.92, 0.84, 0.70 (đúng các điểm đã đo ở trên, còn lại nội suy tuyến tính); ramp có thể ghi đè `tint` (warm dùng profile phẳng hơn: 0.43 … 1 … 0.74) và `canvas` (L bậc 1 theo mode; bậc 1–8 dịch cùng một delta, §3.4). Sau khi dịch canvas, s11/s12 được đẩy về phía chữ tới khi đạt N2. `cool` = 255° / C 0.016, `warm` = 68° / C 0.014, `auto` = hue seed / C 0.016 (D5, giữ nguyên). Alpha (D6): với mỗi bậc, alpha tối thiểu để màu nền-alpha nằm trong 0–255 rồi giải màu; hướng tối/sáng tự ra từ dữ liệu. Alpha đo trên sRGB, chưa có P3 (O4).

### 5.3 Tên phụ cho hue (nhãn slider)

`nameOfHue(h)` (`src/names.ts`) dùng cho nhãn hiển thị; **không** ảnh hưởng bộ sinh, H1/H2 hay `ANCHORS`. Nguyên tắc: hue lõi giữ tên của chính nó trong `[hue−8°, hue+8°)` (nửa mở); tên phụ chỉ phủ khoảng giữa các span lõi; bảng là phân hoạch vòng tròn (24 đoạn, 360°).

| Khoảng (°) | Tên | Tham chiếu thật (góc OKLCH) |
|---|---|---|
| 3–17 | rose | Tailwind rose-500 16.4 |
| 33–44 | coral | CSS `coral` 40.2 |
| 60–72 | carrot | carrot orange `#ed9121` = 64.0 (ứng viên khác: tangerine 58.5, honey 69.5) |
| 88–98 | gold | CSS `gold` 95 |
| 114–125 | yellow-green | CSS `yellowgreen` 127 |
| 141–148 | grass | Radix grass 147 |
| 164–176 | jade | Radix jade 171 |
| 192–206 | turquoise | CSS `mediumturquoise` 192 / `darkturquoise` 197 |
| 222–247 | sky | CSS `deepskyblue` 232, Tailwind sky 237 |
| 263–284 | indigo | Tailwind indigo 277 (CSS `indigo` là màu tối h 302, không dùng) |
| 300–317 | purple | Radix purple 306, Tailwind 304 (CSS `purple` h 328 khác nghĩa, không dùng) |
| 333–347 | raspberry | mô tả, không có tham chiếu |

Lưu ý: tên ở 60–72° là `carrot` (góc 64.0°), không phải peach: peach/apricot thực chất là **tint** (L 0.88–0.91, C ≈ 0.06, CSS `peachpuff` 63.7°, `apricot` 54°) nằm ở step 4–6 của scale orange (ΔE 0.016–0.019), không phải một hue riêng, nên không dùng làm tên hue.

Khảo sát "trộn pink + yellow" (2026-11-04): cung ngắn pink 355° → yellow 106° dài 111°, điểm giữa **50.5°** = orange lõi (lệch 1.5°). Không thể thêm hue thứ 13: khoảng trống lớn nhất giữa hai hue lõi là 41° nên một hue chen vào chỉ cách tối đa 20.5° < 22° (H1); thay orange bằng 62.5° còn cách amber 17.5°. Preview tham khảo: `docs/preview/mix.html`.

---

## 6. Quy tắc contrast → test tự động

Metric: **WCAG 2.x** là cổng cứng (D3). APCA chỉ để thông tin (Radix dùng Lc 60/90; `apca-w3` trên npm có license "Limited W3 License" — không đưa vào dependency cứng).
Mọi test quét: **12 hue lõi × 3 neutral × 2 mode** (36 tổ hợp × 2) + **sweep hue 0–359 bước 1°** cho tính chất scale + **12 preset devglow**.

| ID | Quy tắc | Ngưỡng | Số liệu prototype (sweep 3°, sRGB) |
|---|---|---|---|
| A1 | Mọi màu phát ra nằm trong gamut đích (sRGB cho bản mặc định; P3 cho bản P3) | ε = 1e-4 | ✓ theo cấu trúc |
| A2 | L đơn điệu bậc 1→8 (giảm ở light, tăng ở dark); ΔL giữa bậc kề | ≥ 0.008 (1→2), ≥ 0.020 (còn lại) | ΔL bảng: min 1→2 = 0.009 (neutral light), còn lại ≥ 0.023 |
| A3 | `s11` trên `s1`, `s2`, `s3`; `s12` trên `s1`, `s2`, `s3` | ≥ 4.5; ≥ 7 | min 4.55 / 10.4 (light), 7.3 / 11.6 (dark) |
| A4 | `contrast` foreground trên `s9` **và** `s10` | ≥ 4.5 | min 4.43 / 4.39 — **rớt 3/120 hue** (33°, 246°, 249°): mục mở O1 |
| A5 | Liên tục theo seed: ΔE_OK mọi bậc giữa h và h+1° | ≤ 0.02 | max 0.016 (h=38, s10) |
| A6 | Chroma ≥ κ·0.9·Cmax tại step 9 (không bị rửa) | — | theo cấu trúc |
| P1 | Bản P3: cùng L,h với bản sRGB; C_P3 ≥ C_sRGB; AA (A3, A4) chạy lại bằng Y từ XYZ | như A3/A4 | lệch CR tới ±0.21 → bắt buộc kiểm riêng |
| T1 | Cặp chữ (cài đặt ở `test/theme.test.ts`): `foreground` / `card-foreground` / `popover-foreground` trên background, card, popover, muted, secondary, accent ≥ 7; `muted-foreground` trên cùng danh sách ≥ 4.5; `X-foreground` trên `X` ≥ 4.5 cho primary (và `primary-hover`), secondary, accent, destructive, success, warning, info (sidebar chưa làm) | 7 / 4.5 | min 12.26 (foreground), 4.61 (muted-foreground trên accent, `warm` light), 4.57 (primary-fg), 4.77 (status-fg) |
| T2 | Chữ trạng thái: `X-text` trên background, card, `X-subtle` ≥ 4.5; `X-border` trên background ≥ 1.2:1 (nhận diện, không phải 1.4.11) | 4.5 / 1.2 | min 4.552 (`warning-text` trên `warning-subtle`, light) / 1.598 |
| T3 | Non-text 3:1 (WCAG 1.4.11): `ring` trên background và card; `input` trên background và card; mỗi `chart-n` trên card (chart chưa làm). `border` trang trí: chỉ kiểm ≥ 1.2:1. `ring` = bậc đầu tiên trong [s9, s10, s11, s12] của brand đạt 3.05 trên cả hai bề mặt (brand vàng/amber rơi về s11) | 3 | min **3.050** (`input`), **3.055** (`ring`): biên mỏng; border min 1.331 |
| T4 | Trạng thái phân biệt được: `primary` vs `primary-hover` ở **mọi** hue (bước 0.5°) và κ ∈ {0.35 … 0.85}, cả hai mode (scale); ở lớp token: `primary`/`primary-hover`, `secondary`/`accent`, `accent`/`card` (mỗi 3° hue × 4 neutral × 2 mode) | ΔE_OK ≥ 0.02 | scale min 0.0216 (light, h=243°, κ=0.35); token: xanh |
| T5 | Không dùng đen/trắng tuyệt đối cho `background`/`foreground`/`card`/`popover` (L trong (0.12, 0.995)), kể cả `pageStep: 2` | — | xanh |
| T6 | Dark không phải đảo: dark `L(background) < L(card) ≤ L(popover)`; light mặc định `card = background`; dark nền < 0.3, light nền > 0.9; `muted-foreground` khác nhau theo mode; mỗi mode dùng scale/neutral riêng nên T1–T3 đạt độc lập | — | xanh |
| H1 | 12 hue lõi: khoảng cách hue min | ≥ 22° | 23° |
| H2 | ΔE_OK(step 9) min giữa hai hue lõi bất kỳ | ≥ 0.05 | 0.060 |
| H3 | Tên ↔ góc hue: \|h − h_ref\| nhỏ nhất qua {Tailwind, Radix} | ≤ 8° | max 5° (yellow qua Radix 101°); còn lại ≤ 4.4° |
| H4 | `nameOfHue(h)` trả tên cho **mọi** góc (§5.3): đúng tên lõi trong `[hue−8, hue+8)`, tên phụ ở khoảng giữa, không hở/chồng, bọc vòng 360; kèm `{ kind, core gần nhất, offset có dấu }` | \|offset\| ≤ 21° | `test/names.test.ts` (max 20.5°) |
| C1 | CSS phát ra: mọi `var(--x)` ở L2 trỏ tới primitive đã định nghĩa; `.dark` ghi đè đủ các token khác biệt (không thiếu, không thừa) | — | — |
| C2 | Smoke Tailwind v4: `bg-primary text-primary-foreground border-border ring-ring` build ra CSS đúng (`@tailwindcss/vite` 4.3.4) | — | — |
| R1 | Guard độ gần Radix (devDependency `@radix-ui/colors@3.0.0`): ΔE_OK trung bình 12 cặp ở §4.7 | ≤ 0.035 | 0.022 / 0.020 |
| R2 | Guard neutral gần Radix: `neutral` ~ gray, `cool` ~ slate (ΔE_OK trung bình 12 bậc) | ≤ 0.02 | 0.0000 / 0.0043 (light), 0.0000 / 0.0031 (dark) |
| N1 | Neutral (3 ramp cố định + `auto` mọi hue nguyên 0–359, cả hai mode): 12 bậc, trong sRGB, L đơn điệu (light giảm, dark tăng), ΔL ≥ 0.008, chroma đỉnh ở bậc 9; `neutral` chroma = 0; `auto` hue = seed, chroma ≤ 0.016 | — | `test/neutral.test.ts` |
| N2 | Chữ neutral: s11 ≥ 4.5 và s12 ≥ 7 trên **s1–s4** (background, card, muted, accent; chặt hơn A3 vì `muted-foreground` = N11 phải đạt trên cả `accent` = N4); gồm `warm` (canvas 0.975) và canvas tuỳ ý | 4.5 / 7 | min 4.61 / 12.26 (mọi ramp, 360 seed `auto`, 2 mode) |
| N3 | Viền input (`neutralBorder`): ≥ 3:1 trên mọi bề mặt của nó (`[1]`, `[1,2]`, `[2]`), lớn nhất 3.2:1 (không nặng hơn cần thiết), không nặng hơn N9 khi N9 đã đạt 3.05 | 3 (solve 3.05) | min **3.050** (dark, `auto` 271°, `[1]`): biên mỏng. N9 một mình chỉ còn 3.007 trên s1/s2 ở `warm` light, nên không còn dùng N9 làm viền |
| N4 | `auto` liên tục theo seed: ΔE_OK mọi bậc giữa h và h+1° | < 0.002 | < 0.002 |
| N5 | Alpha neutral: composite (sRGB source-over) lên s1 tái tạo từng bậc ±1/255, alpha ∈ [0,1], bậc 1 trong suốt, không giảm theo bậc, hướng tối (light) / sáng (dark); `BLACK_ALPHA`/`WHITE_ALPHA` = Radix 3.0.0; `black-a11/a12` trên s1 light và `white-a11/a12` trên s1 dark đạt 4.5 / 7 | ±1 mức | sai số max 0.45 mức |
| G | Golden snapshot 12 hue × 2 mode × 2 gamut (hex + oklch) để đổi đường cong phải qua review | — | — |

Quy tắc chung: ngưỡng solve của bộ sinh phải **chặt hơn** ngưỡng test (4.55 vs 4.5; 7.1 vs 7) để làm tròn 8-bit không làm rớt.

---

## 7. Stack

| Hạng mục | Chọn | Lý do (đã kiểm) | Phương án bị loại |
|---|---|---|---|
| Ngôn ngữ | TypeScript. Latest hiện là `typescript@7.0.2`; `tsdown` peer-support `^5 \|\| ^6 \|\| ^7`. Chưa kiểm cặp với Vitest/tsdown ngoài peer range → pin và smoke lúc dựng khung | thuần hàm, dễ test | — |
| Thư viện màu | **`culori@4.0.2`** (MIT) | Có sẵn mọi thứ prototype cần và đã chạy được: `oklch`, `p3`, `inGamut`, `clampChroma`, `converter('xyz65')` (Y cho P3), `wcagContrast`, mô phỏng CVD. `exports` có `culori/fn` (tree-shake) → bundle nhỏ cho portfolio. ~1.1 MB unpacked. | `colorjs.io@0.7.1` (MIT): chuẩn CSS Color 4 đầy đủ hơn (gamut mapping ΔE_OK) nhưng ~15.8 MB unpacked và chưa 1.0. `apca-w3`: license hạn chế |
| Contrast | Tự viết ~10 dòng: `CR = (Y1+0.05)/(Y2+0.05)`, Y từ XYZ D65 (đúng với mọi gamut) | WCAG formula trực tiếp; tránh phụ thuộc `wcag-contrast` (3.0.0, đã 4 năm không cập nhật) | |
| Test | **`bun test`** (built-in, `bun 1.4.4`); không dùng Vitest (D10 = bun) | Sweep bằng vòng lặp thường, không cần fast-check; không thêm dependency test | Vitest 5.1.0 |
| Build | `tsdown@0.23.5` → ESM + `.d.ts`; thêm CJS nếu portfolio cần | peer TS 5–7 | `tsup@9.0.0` vẫn dùng được, không bị npm đánh dấu deprecated |
| Package manager / runtime | **bun 1.4.4** (D10) | đã có trên máy | npm |
| Cấu trúc | Một package: `src/` (hàm thuần), `tools/` (sync devglow, build CSS), `presets/`, `docs/`; demo portfolio là package riêng sau | giữ nhỏ | monorepo từ đầu |
| Tích hợp | Tailwind `4.3.4` + `@tailwindcss/vite` `4.3.4` (smoke C2); `shadcn@4.23.0` CLI chỉ để kiểm token khớp | | |

API: `generateScale`, `generateNeutral`, `neutralAlpha`, `neutralBorder`, `buildTheme(opts) → { light, dark }` (mỗi mode là `Record<token, hex>`), `toCss(theme, opts?)`, `toRuntimeCss`, `toOklchCss(hex)`, `toDtcg(theme)`, `applyThemeToRoot(theme, element?)`, `PRESETS`, `nameOfHue(h)`, `CORE_HUES`, `TOKEN_NAMES`. Chưa có: bản P3.

---

## 8. devglow làm đầu vào

### 8.1 Ánh xạ

| Dữ liệu devglow | Thành | Cách |
|---|---|---|
| Mỗi accent (10 key) | hue gốc cho bộ sinh 12 bậc | Lấy `h` OKLCH đo được, **bỏ qua tên key**; loại accent có C < 0.03 (hue nhiễu: Ash `PINK`, Vesper `PINK` C=0); gộp cụm cách nhau ≤ 20° → còn 3–8 seed/palette |
| L của accent (0.58–0.93) | **không dùng** | L9 do bộ sinh quyết theo AA (§4); L của devglow là L chữ-trên-nền-tối, tương đương step 11 dark chứ không phải step 9 |
| C của accent | `kappa` của preset | `κ = median(C / Cmax(L, h))` rồi kẹp vào [0.35, 0.85]. Đo: 0.26–0.57 (Vesper 1.0 là ngoại lai do L cao → kẹp 0.85) so với mặc định 0.85 |
| `BACKGROUND`, `DARK_00..03` | ramp neutral có pha màu | hue = trung bình vòng tròn có trọng số C; `C9neutral` suy từ C của `DARK_02/03`; `canvasDark = L(BACKGROUND)`; nếu tổng C < 0.004 → neutral thuần |
| `DARK_04` (comment) | tham chiếu cho step 9 neutral | L 0.53–0.58 ≈ N9 dark (0.538); **không** map vào `muted-foreground` (N11, L 0.77) vì DARK_04 < 4.5:1 |
| `FOREGROUND` | tham chiếu cho N12/N11 | chỉ để chọn tint chữ |
| Hue chính của preset | `seed` | devglow `highlights.lua`: `Cursor`, `StatusLine`, `Search`, `PmenuMatch` dùng `YELLOW` → coi `YELLOW` là màu chữ ký; fallback `GOLD`, `ORANGE` nếu C < 0.03 (README Vesper cũng gọi mint `#99FFE4` là accent chữ ký, khớp `YELLOW`) |
| Mỗi palette (Sage, Ember…) | **một theme preset** | `{ id, neutral{h,C,canvasDark}, seed, extraSeeds[], kappa, source{sha} }` |

Tên preset và tên hue ở hai namespace tách biệt (`theme: 'sage'` ≠ `hue: …`); devglow Sage/Amber/Plum trùng tên scale Radix nhưng không phải cùng một thứ.

Bảng preset đo được (nguồn Phụ lục B): neutral h / C / canvas, số cụm hue, κ, seed.

### 8.2 Giữ được triết lý devglow ở đâu

| Triết lý devglow | Giữ | Cơ chế |
|---|---|---|
| "Colors that stay quiet" | ✓ | `kappa` thấp từ palette; test độ phân biệt (H2) chạy ở κ mặc định, preset κ < 0.85 chỉ chịu A/T (AA), không chịu H2 |
| Dark-first | ✓ | preset định nghĩa dark trước (`canvasDark`, neutral); light dẫn xuất |
| OKLCH, khóa hue, giải L tới AA, không đổi hue | ✓ | trùng thuật toán `derive_light`; ta mở rộng cho cả dark |
| Không trắng/đen tuyệt đối | ✓ | T5 |
| Neutral theo "nhiệt độ" palette | ✓ (đúng nghĩa, từ dữ liệu) | hue/C từ `BACKGROUND` + `DARK_00..03`; riêng Sage/Vesper dữ liệu = xám thuần thì giữ xám thuần |
| Audit contrast kiểu `:DevglowAudit` | ✓ | thành test T/A (§6), chạy cả dark |
| Bảng override thưa theo palette | ✓ | `presets/overrides/<id>.json` (tùy chọn); override cũng phải qua test |
| Tên mood ("one for the quiet night") | ✓ | metadata `label`, `tagline` của preset |

### 8.3 Phải đổi để đạt AA cho UI

| Vấn đề trong devglow | Số liệu | Đổi gì |
|---|---|---|
| Màu syntax tối-trên-sáng-tối: dùng làm nền nút + chữ trắng | 106/120 < 4.5 | L9 theo AA + `-contrast` theo hue (§3.2). Giữ hue và κ, bỏ L |
| Accent trên nền palette | 14/120 < 4.5 (dark) | Chữ/accent luôn dùng step 11 (giải ≥ 4.55), không dùng accent nguyên bản |
| `DARK_04` làm muted text | 11/12 < 4.5 (min 2.85 Vesper) | `muted-foreground = N11` |
| `DARK_03` làm border/selection | 1.53–1.71:1 | `border` trang trí; `input`/`ring` giải ≥ 3:1 (T3) |
| Tên key ≠ hue (GREEN 61°–196°) | — | Không dùng tên key; tên hue sinh từ góc đo (`nameOfHue`) |
| Hue trùng (Ember: 4 key ≈196°) | 3–8 cụm/palette | Gộp cụm ≤ 20° |
| Chroma thấp làm step 3–8 gần như xám | κ 0.26–0.57 | sàn κ ≥ 0.35 cho preset |
| Light mode derive riêng | — | Dùng bộ sinh chung (đồng nhất dark/light), không port `derive.lua` |

### 8.4 Đồng bộ khi devglow cập nhật

| Cách | Ưu | Nhược |
|---|---|---|
| A. Đọc trực tiếp file nguồn lúc build | luôn mới | build phụ thuộc mạng và định dạng Lua; palette đổi → contrast đổi âm thầm; repo devglow chưa có tag, 12 palette còn `[Unreleased]` |
| B. Chép một lần | ổn định | mất liên kết nguồn; không biết khi nào lệch |
| **C. Chép có ghim + script đồng bộ thủ công (khuyến nghị)** | ổn định, có provenance, đổi nguồn là một diff duyệt được | cần chạy tay |

Thiết kế C:

1. `tools/sync-devglow.ts --ref <sha> [--path <local>]`: clone nông (hoặc đọc thư mục cục bộ), parse 12 file `lua/devglow/palettes/*.lua` bằng regex `^\s*([A-Z_0-9]+)\s*=\s*"(#[0-9A-Fa-f]{6})"` (đã kiểm: 17 key/palette), **assert đủ 17 key**, ghi `presets/devglow.snapshot.json` = `{ source: { repo, sha, fetchedAt, license: 'MIT', copyright: '2025 Phat Nguyen' }, palettes: { sage: { FOREGROUND: '#…', … } } }`.
2. `derivePreset(snapshot)`: hàm thuần (§8.1), có golden test; sinh `presets/devglow.json`.
3. CI/build chỉ đọc snapshot, không mạng.
4. Khi sync: script in diff theo palette (đổi hue > 5°, κ, neutral) và chạy lại toàn bộ test T/A/H; chỉ merge nếu xanh. Không auto-merge.
5. `NOTICE` ghi MIT © 2025 Phat Nguyen + sha. (Palette là dữ liệu hex; vẫn ghi attribution vì rẻ và đúng tinh thần MIT.)

---

## 9. Checklist bắt buộc → cách đáp ứng

| Mục cần tránh | Đáp ứng ở | Test |
|---|---|---|
| Foreground cố định cho mọi hue | §3.2: foreground giải theo từng hue × mode, 4 ứng viên, kiểm trên s9 và s10 | A4, T1 |
| Tên hue lệch góc hue thật | §5.1: tên gắn với góc, đối chiếu Tailwind + Radix; `nameOfHue` cho seed tự do; devglow không dùng tên key | H3, H4 |
| Hue dồn cụm | 12 hue, gap min 23°, ΔE min 0.060 (Radix 3.9° / 0.023); gộp cụm ≤ 20° khi nhập devglow | H1, H2 |
| Thiếu token nền/viền/chữ/ring/destructive | §3.3: đủ nền (background, card, popover, muted, secondary, accent, sidebar), viền (border, input, sidebar-border), chữ (foreground, muted-foreground, *-foreground), ring, destructive **+ `destructive-foreground`**, thêm success/warning/info | C1, T1–T3 |
| Dark mode chỉ đảo ngược | §4.2 bảng L/C dark riêng; §3.3 elevation card/popover; input/ring tính lại; `canvas`; s10 theo hue | T6 |

---

## 10. Quyết định (đã chốt 2026-11-04)

| # | Quyết định | Chốt |
|---|---|---|
| D1 | Số hue lõi | **12** (gap 23°, ΔE 0.060); sky/indigo là bộ mở rộng sau |
| D2 | Chính sách nút solid | **AA-first** (nút teal/green/cyan/orange/lime/amber/yellow dùng chữ đen; blue tối hơn Radix) |
| D3 | Metric contrast | **WCAG 2.x là cổng chặn**; APCA chỉ báo cáo (không phải test, không dùng `apca-w3`) |
| D4 | `input` border | **Nghiêm** ≥ 3:1 (WCAG 1.4.11) là mặc định (`neutralBorder`). Tuỳ chọn **"mềm"** (viền nhẹ hơn, không đảm bảo 3:1) có thể thêm sau, **chỉ khi ô nhập có nền riêng** (fill phân biệt với bề mặt) để vẫn nhận diện được theo 1.4.11; **chưa cài**, và nếu cài phải là tuỳ chọn theme tường minh (`inputBorder: 'soft'`), không phải mặc định |
| D5 | Neutral cho slider | 3 ramp cố định **+ `auto`** (đi theo seed hue, C ≤ 0.016) |
| D6 | Alpha | **Chỉ neutral + white/black** |
| D7 | Token trạng thái | **Đủ 5 token**: `destructive/success/warning/info` × {X, foreground, subtle, text, border} |
| D8 | Đồng bộ devglow | **Chép + ghim + script** (§8.4, phương án C) |
| D9 | Hue chính preset devglow | **Chọn tay theo mood** (bảng dưới), cho phép override trong `presets/overrides` |
| D10 | Package manager | **bun** |
| D11 | Tên package & repo | **gennex-color** |

D9 — hue chọn tay (OKLCH h): sage 150, ember 40, blush 5, amber 75, dusk 355, vesper 175, moss 135, tide 200, mocha 60, plum 320, ash 107, nocturne 270.

Quyết định nhỏ tôi đã tự chọn (đánh dấu để bạn soát): hue không drift (§4.5); `warm` = 70°/C 0.012 và `cool` = 255°/C 0.016 (§5.2); `radius` = 0.625rem; hue trạng thái mặc định red/green/amber/blue; ưu tiên chữ pha hue, rơi về thuần khi cần; CVD chỉ thông tin.

---

## 11. Rủi ro / mục mở

| # | Mục | Chi tiết | Xử lý |
|---|---|---|---|
| O1 | **Vùng chết foreground ở biên chữ trắng/đen** | **Đã sửa** (`src/scale.ts`). Nguyên nhân thật: s9 và s10 nằm hai phía ngưỡng đổi chữ (rớt ở 30–34° và 246–250°, không chỉ 3 seed). Sửa: pivot luminance Y = √(0.05·1.05) − 0.05 ≈ 0.179 (chữ trắng và đen thuần đều ≈ 4.58:1); hướng hover δ đổi dấu liên tục quanh L pivot của từng hue. Trong ±0.04 L quanh pivot, hover chuyển sang khác biệt bằng **chroma** ở cùng luminance (iso-Y) nên CR của foreground không đổi và T4 giữ ở mọi hue. Còn lại: foreground là trắng/đen thuần ở 30–36° và 240.5–247° (κ=0.85) | Biên mỏng: hover ΔE min 0.0216 (ngưỡng 0.02), độ liên tục max 0.018 ΔE/độ (ngưỡng 0.02) — đổi hằng số phải chạy lại A5 và T4 |
| O2 | Step 11–12 của yellow/amber ô-liu | **Đã chấp nhận** (soát mắt 2026-11-04): giữ nguyên, không thêm bảng drift hue (§4.5) | — |
| O3 | Hiển thị P3 và hành vi `oklch()` ngoài gamut | Chưa test trình duyệt | Phase 1: kiểm Chrome/Safari/Firefox |
| O4 | Alpha P3 | Chưa prototype | Chỉ làm nếu D6 mở rộng |
| O5 | `typescript@7.0.2` + Vitest 5.1 + tsdown 0.23.5 | Chỉ kiểm peer range | Smoke khi dựng khung |
| O6 | Đo trên sRGB là chính | Prototype P3 chỉ kiểm step 9 vs foreground | P1 |
| O7 | Prototype không nằm trong repo | Số liệu không tái lập được từ repo cho tới khi viết code | Phase 1 chuyển các sweep thành test; giữ Phụ lục A |
| O8 | Hue drift Radix dark không nhất quán | Không dùng để chỉnh | — |
| O9 | **shadcn dùng `text-primary` / `text-destructive` làm màu chữ**, nhưng `primary`/`destructive` là màu nền đặc | **Đã sửa (phương án a, 2026-11-04)** trong `src/theme.ts` (`solidWithText`) | Sửa sau rà registry (mục 12). Bản đầu nhảy theo bậc s9–s12 làm mọi primary ở light thành s12 gần đen; đã đổi sang dịch L liên tục. Đã đo trước khi sửa: 24/48 mẫu primary/destructive dưới 4.5 làm chữ, **gồm 7 mẫu light (primary của 7 hue sáng như yellow), không chỉ dark như tôi báo ban đầu** |

---

## 12. Xuất bản (Phase 4)

**Token**: thêm `chart-1…5` và `sidebar-*` (8 token) → 51 token mỗi mode. `sidebar` = N2 (dark: bằng `card`; light: hơi tối hơn page), `sidebar-primary` = `primary`, `sidebar-accent` = N4, `sidebar-ring` = `ring`. Chart: các hue lõi cách hue brand ≥ 22°, mỗi màu được nâng tới ≥ 3:1 trên background và card (bậc đầu tiên trong s9–s12), chọn greedy max-min ΔE (OKLab) so với brand và các màu đã chọn. `ring` và `input` giờ tính cho cả sidebar. Test: `test/pairs.ts` (bảng cặp dùng chung), min đo được: chart/card 3.222, ring/sidebar 3.111, input 3.050, chart ΔE min 0.107 (giữa các chart) / 0.111 (so brand).

**CSS** (`toCss`): `:root` (có `--radius: 0.625rem`), `.dark`, `@theme inline` ánh xạ mọi token `--color-*: var(--*)` + thang radius shadcn. Tên biến khớp danh sách token trong docs shadcn theming; token mở rộng (primary-hover, destructive-foreground, success-*, …) được phát và ánh xạ giống nhau. Giá trị `oklch(L C h)` (L, C 4 chữ số, h 2 chữ số) sinh từ hex 8-bit nên khớp test contrast; test round-trip oklch → hex cho mọi token. Mọi build đã kiểm: Lightning CSS (Vite) đổi `oklch(0.99 …)` thành `oklch(99% …)`; vẫn cùng giá trị.

**DTCG** (`toDtcg`): theo Design Tokens Color Module 2025.10 (bản draft trên designtokens.org ghi "preview, không implement"; format `$value = { colorSpace, components, hex }` là của bản 2025.10 đã công bố): hai nhóm `light` và `dark`, mỗi token `$type: "color"`, `colorSpace: "srgb"`, `components` 0–1, `hex` 6 chữ số, không alpha.

**Package** (`gennex-color@0.0.0`, chưa publish): `exports` gồm `.` (ESM + `.d.mts`), `./css/<preset>.css`, `./tokens/<preset>.tokens.json`. `bun run build` = tsdown + `scripts/build-assets.ts` (12 preset, tên theo hue lõi: red … pink, neutral = gray). Preset ngoài bộ này: gọi `buildTheme`. Preset devglow (D8/D9) chưa làm.

**Smoke**: `bun run smoke` (dist JS + file CSS/JSON khớp hàm), `bun run smoke:example` (đóng gói tarball thật bằng `bun pm pack`, giải vào `examples/vite-app` — Vite + Tailwind v4 + shadcn `radix-nova` Button/Input/Card sinh bằng `shadcn@4.23.0` CLI — build, kiểm 102 biến theme có trong CSS đã build, utility `bg-primary`… được sinh, theme mặc định shadcn không rò rỉ). Đã xem trực quan light và dark bằng Chrome headless.

## 12.1 Rà registry shadcn (O9)

Nguồn: registry `radix-nova` của `shadcn@4.23.0` (64 component `registry:ui`, tải 2026-11-04). Token dùng làm **chữ** (số component): `muted-foreground` 35, `foreground` 24, `popover-foreground` 13, `destructive` 12, `accent-foreground` 5, `primary` 5, `primary-foreground` 9, `secondary-foreground` 3, `card-foreground` 3, `sidebar-*` 1, `background` 2 (tooltip, kbd). Nền alpha: `destructive/10|20|30` (8 component), `primary/80` hover (3), `secondary/80` (2), `muted/50` (12), `input/30|50|80` (15+), `primary/5|10`, `background/10|20` (kbd). Chữ alpha: `destructive/80|90`, `foreground/60` (tabs), `muted-foreground/70` (trace), `sidebar-foreground/70`. Viền/ring: `border-ring` + `ring-ring/50` (focus), `aria-invalid:border-destructive` + `ring-destructive/20|40`, `ring-foreground/10` (popover), `border-primary` (checkbox/radio đã chọn). Màu ngoài token: `bg-black/10` (dialog, sheet, drawer, overlay), `bg-white` (slider).

**T7** (`test/pairs.ts`, gate): `text-primary` / `text-destructive` ≥ 4.5 trên background, card, popover, muted, sidebar và trên `muted/50`; `destructive` trên `destructive/10|20` (light) và `/20|30` (dark) phủ lên background/card/popover; `primary-foreground` trên `primary/80` và `secondary-foreground` trên `secondary/80`; `foreground`/`muted-foreground` trên `muted/50`, `primary/5`, `input/30` (dark); `background` trên `foreground` (tooltip) và trên `background/20|10` phủ lên foreground (kbd); chữ alpha `destructive/90`, `/80` (trên card) và `sidebar-foreground/70`; `destructive` ≥ 3:1 làm viền `aria-invalid`. Min đo được trên mọi seed (neutral auto): 4.550 (`hover:bg-primary/80`), 4.559 (`destructive` trên tint), 4.565 (`/80`); hover ΔE min 0.028.

**Không gate** (chữ alpha của chính component, token không cứu được): `text-foreground/60` trên muted (tabs không hoạt động) min **4.09**, `text-muted-foreground/70` (trace) min **2.97**. Halo `ring-ring/50` và `ring-destructive/20|40` là trang trí; viền `border-ring` đầy đủ vẫn có khi focus.

Hệ quả nhìn thấy: ở **light**, mọi `primary` đậm hơn s9 (ví dụ blue `#246dc1` → `#1b569b`, yellow `#e2da4d` → `#5a5619` olive đậm); ở **dark**, primary của red/blue/violet/magenta/pink sáng hơn (blue `#4290ef`), destructive `#f6a39c`; primary các hue sáng (yellow … cyan) giữ s9 ở dark.

### 12.2 `primaryMode`: `accessible` (mặc định) | `vivid`

`buildTheme({ primaryMode })`. **accessible** (mặc định, đã duyệt): `primary` tự nó đọc được làm chữ (như trên); `primary-text` = `primary`. **vivid**: `primary` giữ độ sáng cao nhất mà vẫn thỏa các nghĩa vụ foreground (chữ trên `primary`, hover, `primary/80`), không bị ép đọc được làm chữ; `primary-text` (đạt ≥ 4.5 trên background, card, popover, muted, sidebar, `muted/50`) gánh vai trò chữ. Cặp `text-primary` được miễn ở vivid (`textPrimary` trong `test/pairs.ts`), **mọi cặp khác vẫn đạt**; cặp `primary-text` luôn gate. `primary-text` được xuất ở CSS (`--primary-text`, `--color-primary-text` → utility `text-primary-text`) và DTCG.

Tác dụng thực tế (đo): vivid trả lại màu sáng cho hue chữ-đen ở light (orange `#e77f36`, amber `#edb344`, yellow `#e2da4d`, lime, green, teal, cyan giữ step 9 thay vì `#83451a`/`#6c501a`/`#5a5619`…) và cho hue chữ-trắng ở dark (blue `#246dc1` thay vì `#4290ef`). Các hue chữ-trắng ở light (red, blue, violet, magenta, pink) **gần như không đổi** vì `primary-foreground` trên hover `primary/80` đã buộc tối. Ví dụ yellow light vivid: `primary` `#e2da4d` chỉ 1.4:1 trên nền trắng (không đọc được làm chữ), `primary-text` `#736f23`.

5 component dùng `text-primary` làm chữ (đếm từ registry `radix-nova` của `shadcn@4.23.0`, mỗi nơi 1 chỗ): `item`, `empty`, `field` (link `[&>a:hover]:text-primary`), `badge` (variant link) và `button` (variant link). Ghi đè sang `primary-text` khi dùng vivid: `perl -pi -e 's/text-primary(?![\w-])/text-primary-text/g' src/components/ui/{item,empty,field,badge,button}.tsx` (lookahead không đụng `text-primary-foreground`; đã chạy thử trên example, Tailwind sinh `.text-primary-text`). Xem README.


### 12.3 Đổi theme lúc chạy: `applyThemeToRoot(theme, element?)`

Dùng cho demo thanh trượt hue. Cơ chế (`src/runtime.ts`): giữ **một** `<style data-gennex-theme-style>` trong `<head>` chứa chỉ các biến (`toRuntimeCss`, không có `@theme`/radius; `@theme inline` và giá trị mặc định vẫn do file CSS tĩnh cung cấp) và chỉ thay text của nó. Cả hai mode đều được ghi nên bật/tắt `.dark` không cần gọi lại. Root: selector `:root:root` (light) và `:root.dark` (dark), cao hơn `:root`/`.dark` của CSS tĩnh bất kể thứ tự stylesheet (`.dark` phải ở `<html>` như shadcn). Element khác: gắn `data-gennex-theme="<id>"`; dark khi nó hoặc tổ tiên có `.dark`.

**Không layout shift**: chỉ đổi custom property; không thêm node vào `<body>`, không đổi attribute/class/style của root; gọi lại với theme giống hệt không ghi gì (cùng text node). Test (`test/runtime.test.ts`, happy-dom, 8 test): biến computed theo theme và theo `.dark` (không gọi lại khi toggle), một `<style>` duy nhất qua 4 lần cập nhật và 90 hue liên tiếp, body/root không đổi, scope theo element độc lập, mặc định dùng `document` toàn cục, ném lỗi rõ ràng khi không có DOM. Đột biến thử: bỏ điều kiện "chỉ ghi khi khác" làm test layout đỏ; đổi `:root:root` thành `:root` làm test nội dung đỏ.

Chi phí: `buildTheme` ≈ **5.3 ms** mỗi lần (360 hue, neutral `auto`, cả hai mode) trong Bun; trong trình duyệt tổng 9.8 ms ở 1× và 38 ms ở 4× chậm (xem 12.4). Example (`examples/vite-app/src/components/theme-slider.tsx`) gộp mỗi frame một lần cập nhật bằng `requestAnimationFrame`. Đã kiểm trong Chrome headless: tải `?hue=40` và `?hue=140` cho đúng một `<style>`, màu primary/nền đổi theo (coral light, lime dark).

### 12.4 Hiệu năng thanh trượt (đo trong Chrome headless)

`scripts/perf-example.ts` (Chrome DevTools Protocol, không thêm dependency) kéo hue 0→360 bước 3° trên app example đã build; mỗi lần cập nhật gồm `buildTheme` + `applyThemeToRoot` + ép tính lại style. Layout/paint không nằm trong số đo. Example hiển thị chỉ số này ngay dưới thanh trượt.

| CPU | Tổng/lần: median / p95 / max | buildTheme | applyThemeToRoot | Style recalc | Khoảng giữa các frame |
|---|---|---|---|---|---|
| 1× | 9.8 / 13.6 / 18.3 ms | 7.4 ms | 0.3 ms | 2.0 ms | 16.7 ms |
| **4× chậm** | **38.0 / 41.2 / 48.7 ms** | 29.5 ms | 1.1 ms | 7.2 ms | 49.9 ms (≈ 20 fps) |

**Vượt 16 ms ở 4×** (và p95/max chạm 14–18 ms ở 1×). `buildTheme` là 75–78% tổng. Trong Bun nó 5.2 ms, trong đó ~30 lần `generateScale` (0.13 ms/lần) ≈ 3.9 ms; **28 trong 30 lần dùng hue không đổi khi kéo thanh trượt** (4 hue trạng thái cố định ×2 mode, ~10 hue lõi của chart ×2 mode, chỉ brand ×2 mode là đổi).

**Đã làm (đề xuất 1 và 4)**: `generateScale` có cache LRU 512 mục theo `(hue chuẩn hóa, kappa, mode)`, trả object đóng băng (dùng chung, chỉ đọc); `generateScaleUncached` giữ để so sánh. Example áp theme vào khối `#demo-block` bằng `applyThemeToRoot(theme, element)` thay vì `:root`. Đo lại cùng phương pháp:

| Cấu hình | CPU | Tổng/lần (median / p95 / max) | buildTheme | Style recalc |
|---|---|---|---|---|
| Trước | 1× | 9.8 / 13.6 / 18.3 ms | 7.4 ms | 2.0 ms |
| Trước | 4× | 38.0 / 41.2 / 48.7 ms | 29.5 ms | 7.2 ms |
| Cache (apply vào `:root`) | 1× | 4.0 / 5.0 / 8.1 ms | 1.7 ms | 2.0 ms |
| Cache (apply vào `:root`) | 4× | **15.1** / 18.6 / 24.4 ms | 6.4 ms | 7.5 ms |
| Cache + container | 1× | 4.0 / 4.5 / 6.3 ms | 1.7 ms | 2.0 ms |
| Cache + container | 4× | **16.1** / 20.1 / 31.0 ms | 7.0 ms | 7.8 ms |

Trong Bun `buildTheme` từ 5.2 xuống 1.1 ms (bộ test cũng nhanh hơn: 16 → 5 s). **Kết luận**: cache cho gần toàn bộ mức giảm; áp vào container **không giảm thêm** vì khối demo gần như là cả trang (style recalc không đổi; chênh 15.1 vs 16.1 là nhiễu). Ở 4× chậm median 15–16 ms nhưng p95 19–20 ms và max 24–31 ms: vẫn rớt một số frame (khoảng giữa frame p95 33 ms). Style recalc (7.5 ms ở 4×) giờ ngang `buildTheme`; giảm tiếp cần đề xuất 2/3 (phần cố định khác trong `buildTheme`, bỏ frame) hoặc trang lớn hơn mới thấy lợi ích của container.

Đề xuất ban đầu (đánh dấu cái đã làm):
1. **Cache `generateScale` theo `(hue, kappa, mode)`** (Map nhỏ, hoặc LRU vài trăm mục). Kéo thanh trượt chỉ tính 2 scale brand mỗi lần; ước lượng buildTheme còn ~25% (≈ 7.4 → ~2 ms ở 1×; ≈ 8 ms ở 4×). Tổng ở 4× khi đó ≈ 16–17 ms: sát ngưỡng, nên kết hợp 2.
2. **Tách phần phụ thuộc brand khỏi phần cố định** trong `buildTheme`: status/chart-candidates tính một lần khi `status`/`kappa` không đổi, nhận qua đối tượng `ThemeBuilder` giữ cache (`createThemeBuilder(opts).build(hue)`); cache sống theo builder nên không có trạng thái toàn cục ẩn.
3. **Giảm tần suất**: cập nhật cách frame khi rảnh (đo > 12 ms thì bỏ qua frame kế) hoặc `requestIdleCallback`; thanh trượt vẫn mượt vì chỉ trễ màu.
4. **Giảm style recalc** (7.2 ms ở 4×): áp dụng vào container demo (`applyThemeToRoot(theme, container)`) thay vì `:root` để chỉ subtree cần tính lại.
5. Đẩy `buildTheme` sang Web Worker (chỉ trả `Theme`); tốn truyền dữ liệu nhưng giải phóng main thread. Làm sau cùng.

### 12.5 Preset devglow (D8 + D9, đã cài)

**Đồng bộ (D8, phương án C)**: `bun tools/sync-devglow.ts --ref <sha> [--path <checkout>]` chép 12 file `lua/devglow/palettes/*.lua` + tagline trong README ở commit ghim vào `presets/devglow.snapshot.json` (`source: { repo, sha, fetchedAt, license: "MIT", copyright }`), ghi `NOTICE` (MIT © 2025 Phat Nguyen + sha), assert đủ 17 key hex mỗi palette, rồi in những gì đổi so với snapshot cũ (hue neutral > 5°, chroma, κ). Build và test chỉ đọc snapshot, không mạng. Snapshot hiện ở devglow `5c131e1a3d75e54392e1d6af16b0f7553e1164ec` (2026-07-19). `NOTICE` nằm trong gói (`files`).

**Suy ra preset** (`derivePreset`, `src/devglow.ts`, hàm thuần): neutral hue = trung bình vòng có trọng số chroma của `BACKGROUND`, `DARK_00..03`; chroma bậc 9 = trung bình của `C(DARK_02)/0.31` và `C(DARK_03)/0.49` (xấp xỉ bậc 3–4 và 5–6 của ramp), kẹp ≤ 0.03; `canvas.dark` = L của `BACKGROUND`; tổng chroma < 0.004 → neutral xám thuần. κ = median `C/Cmax(L,h)` của accent có C ≥ 0.03, kẹp [0.35, 0.85]. **Hue chính chọn tay theo mood (D9)**, không đọc từ dữ liệu: sage 150, ember 40, blush 5, amber 75, dusk 355, vesper 175, moss 135, tide 200, mocha 60, plum 320, ash 107, nocturne 270.

| Preset | Hue chính | κ | Neutral h / C | Canvas dark | Nền dark | Tagline |
|---|---|---|---|---|---|---|
| sage | 150 | 0.49 | xám thuần | 0.134 | `#080808` | one for the quiet night |
| ember | 40 | 0.57 | 86.6° / 0.018 | 0.187 | `#131312` | one for the fire |
| blush | 5 | 0.35 | 17.5° / 0.017 | 0.147 | `#0b0a0a` | one for the tender night |
| amber | 75 | 0.46 | 89° / 0.030* | 0.151 | `#0c0b0a` | one for the golden hour |
| dusk | 355 | 0.49 | 296.8° / 0.030* | 0.143 | `#0a090b` | one for the fading light |
| vesper | 175 | 0.85 | xám thuần | 0.173 | `#101010` | one for the evening star |
| moss | 135 | 0.41 | 128.4° / 0.030* | 0.150 | `#0b0b0a` | one for the deep wood |
| tide | 200 | 0.40 | 252.2° / 0.030* | 0.138 | `#08090a` | one for the still water |
| mocha | 60 | 0.52 | 63.4° / 0.030* | 0.149 | `#0c0b0a` | one for the late café |
| plum | 320 | 0.44 | 304.6° / 0.030* | 0.141 | `#09090a` | one for the violet hour |
| ash | 107 | 0.35 | 106.6° / 0.005 | 0.149 | `#0b0b0b` | one for the blank page |
| nocturne | 270 | 0.46 | 274° / 0.030* | 0.142 | `#09090b` | one for the midnight watch |

\* chạm trần 0.030: trần quyết định độ ám màu của nền, 7/12 palette đụng trần, tức dữ liệu devglow muốn nền ám màu hơn mức ta cho phép. Nền dark của sage (`#080808`) và vesper (`#101010`) trùng đúng `BACKGROUND` của devglow.

**Đầu ra**: `DEVGLOW_PRESETS` (`ThemeOptions`), `DEVGLOW_TAGLINES`, `DEVGLOW_SEED_HUES`, `derivePreset` từ `gennex-color`; file dựng sẵn `gennex-color/css/devglow-<tên>.css` và `gennex-color/tokens/devglow-<tên>.tokens.json` (24 preset tổng cộng cùng 12 preset hue). Test (`test/devglow.test.ts`, 12 test): parser từ fixture thật (từ chối thiếu key/hex hỏng), snapshot (sha 40 hex, MIT, tagline), neutral hue khớp số đo Phụ lục B ±4°, κ khớp ±0.015, mood (ember/amber/mocha/moss ấm, tide/nocturne/plum/dusk lạnh), hàm thuần, và **mọi cặp contrast ở cả hai `primaryMode`** cho cả 12 preset.

Hệ quả đã biết: κ 0.35–0.5 làm brand "trầm" như tinh thần devglow nhưng `primary` ở light cũng trầm hơn preset hue (ví dụ amber `#635139`). Palette gốc của devglow là dark-first, light ở đây là phần dẫn xuất của ta.

## Phụ lục A — Cách tái lập số liệu

Script ở `/tmp/probe` (ephemeral): `radix.mjs` (median L/C/hue theo bậc, step 9, khoảng cách hue), `fit.mjs` (step 9 vs cusp gamut), `drift.mjs`/`drift2.mjs` (độ dốc drift, lợi ích), `gen.mjs` (bộ sinh prototype: `scale(h, dark)`), `eval1–3.mjs` (so Radix), `eval2.mjs` (sweep luật A3/A4), `cont.mjs` (liên tục 1°), `hues.mjs` (khoảng cách hue/ΔE), `p3.mjs`, `shad.mjs` (audit shadcn), `dg.mjs`/`presets.mjs` (devglow), `swatch.mjs` (SVG + CVD), `time.mjs`.

Quy ước đo: WCAG CR từ Y (XYZ D65); ΔE_OK = Euclid trong OKLab (`culori`); contrast bộ sinh tính trên hex 8-bit làm tròn; Cmax bằng bisection `inGamut('rgb'|'p3')`.

Prototype đã vá 3 lỗi trong lúc đo (ghi để Phase 1 không lặp lại): kẹp `L9` bằng cusp làm s9 nhảy ΔE 0.042 quanh hue 263–265 (bỏ kẹp); dấu δ của s10 đổi khi đổi chế độ chữ làm s10 nhảy ΔE 0.09–0.12 (δ liên tục); chọn foreground chỉ theo s9 bỏ sót s10 (chọn theo `min(CR(s9), CR(s10))`).

## Phụ lục B — 12 palette devglow → thông số preset (đo từ `5c131e1`)

Cụm hue = cụm accent C ≥ 0.03 cách nhau > 20°. `κ` = median `C/Cmax(L,h)` (thô, chưa kẹp). Seed = hue `YELLOW` key.

| Preset | Neutral h / C(N3-level) | canvas dark L | #accent C≥0.03 | #cụm hue | κ thô | Seed (h / C) |
|---|---|---|---|---|---|---|
| amber | 89° / 0.014 | 0.151 | 9 | 5 | 0.46 | 81° / 0.11 |
| ash | 107° / 0.002 | 0.149 | 4 | 3 | 0.26 | 101° / 0.04 |
| blush | 18° / 0.007 | 0.147 | 9 | 4 | 0.35 | 78° / 0.07 |
| dusk | 297° / 0.020 | 0.143 | 10 | 6 | 0.49 | 73° / 0.09 |
| ember | 87° / 0.007 | 0.187 | 10 | 3 | 0.57 | 85° / 0.11 |
| mocha | 63° / 0.021 | 0.149 | 8 | 4 | 0.52 | 81° / 0.09 |
| moss | 128° / 0.024 | 0.150 | 9 | 4 | 0.41 | 94° / 0.09 |
| nocturne | 274° / 0.021 | 0.142 | 10 | 8 | 0.46 | 97° / 0.08 |
| plum | 305° / 0.030 | 0.141 | 10 | 7 | 0.44 | 85° / 0.08 |
| sage | — (xám thuần) / 0 | 0.134 | 10 | 5 | 0.49 | 78° / 0.11 |
| tide | 252° / 0.023 | 0.138 | 10 | 6 | 0.40 | 90° / 0.06 |
| vesper | — / 0 | 0.173 | 7 | 3 | 1.00 → kẹp 0.85 | 175° / 0.10 |

Ghi chú: seed của 11/12 palette rơi vào 73°–101° (vùng amber/yellow); chỉ Vesper khác (175°, teal/mint). Điều này khiến 11 preset có hue chính gần nhau; sự khác biệt giữa chúng chủ yếu nằm ở neutral và κ. Nếu muốn preset đa dạng hơn, D9 nên chuyển sang chọn tay hoặc dùng `ORANGE`/`RED`.
