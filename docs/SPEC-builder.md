# SPEC — Builder, mã chia sẻ, CLI `apply`, registry (Phase 5, chỉ phần màu)

- Trạng thái: **draft, chờ chốt quyết định (§9)**. Chưa có code. Đọc cùng [`SPEC.md`](SPEC.md) (§3 token, §12 xuất bản).
- Phạm vi: **chỉ màu** (52 token, §README). Không đụng font, radius, icon, style, base của shadcn.
- Mọi điều ghi "đã kiểm" là chạy thật với `shadcn@4.23.0` ngày 2026-11-05 trên bản sao của `examples/vite-app` trong `/tmp`. Điều không kiểm được ghi riêng ở §10.

---

## 0. Nguồn đã đọc và thực nghiệm

| Nguồn | Nội dung dùng |
|---|---|
| `ui.shadcn.com/docs/cli` (đủ) | `init` (alias `create`, cờ `-t -b -p/--preset -n -c -y`), `apply [preset] [--only theme\|font]`, nhóm `preset` (`decode`, `resolve`/`info`, `url`, `open`), `add [--dry-run] [--diff] [--view]`, `build`, `registry add/validate` |
| `registry-item.json` (đủ) | `type: registry:theme`, `cssVars.{theme,light,dark}`, `css`, `$schema`; `registryDependencies` nhận tên, `@ns/item`, `owner/repo/item`, URL, đường dẫn file |
| `registry/examples` (300/1328 dòng) | mẫu `registry:theme` (cssVars light/dark dạng `oklch()`), `registry:style` với `extends` |
| `registry/github`, `registry/namespace` (đầu trang) | repo GitHub có `registry.json` ở gốc dùng được qua `add owner/repo/item`; namespace `@ns` cấu hình `registries` trong `components.json` bằng URL có `{name}` |
| `ui.shadcn.com/create` | **không đọc được nội dung**: trang render phía client, HTML tĩnh không có control. Thông tin về preset lấy từ CLI (dưới) |
| Gói `shadcn@4.23.0` (`shadcn/preset`) | enum thật của preset; `decodePreset`/`encodePreset` |

**Preset của shadcn (đo bằng gói `shadcn/preset`)**: mã như `a2r6bw` = 1 ký tự phiên bản + payload base62. Giải mã ra `{ menuColor, menuAccent, radius, font, iconLibrary, theme, baseColor, style, fontHeading, chartColor }`. `theme` là **enum 25 tên** (`neutral stone zinc gray amber blue cyan emerald fuchsia green indigo lime orange pink purple red rose sky teal violet mauve olive mist taupe`), `baseColor` 8 tên, `style` 8 (`nova vega maia lyra mira luma sera rhea`), `radius` 5 mức. URL: `https://ui.shadcn.com/create?preset=<code>`. **Hệ quả: preset shadcn không thể mang màu tuỳ ý**, nên màu của ta cần mã riêng và bước riêng (§5).

**Thực nghiệm CSS (shadcn@4.23.0)**

| # | Thí nghiệm | Kết quả |
|---|---|---|
| E1 | `apply a2r6bw --only theme` trên file **chưa có** `:root`/`.dark` | thêm 38 dòng vào `@theme inline` (`--color-*`, `--radius-*`), **nối thêm** `:root {…}` và `.dark {…}` cuối file; `@import "gennex-color/css/blue.css"` của ta vẫn nằm trên → khối của shadcn nằm sau nên thắng |
| E2 | `add ./item.json` (`registry:theme`) lần 1 | thêm `--color-*` vào `@theme inline` (kể cả `--radius-*` khi item có `--radius`), nối `:root`, `.dark` |
| E3 | `add` lần 2, giá trị khác, trên file đã có `:root` do chính nó tạo | **sửa tại chỗ**, không nhân đôi khối |
| E4 | như E3 nhưng `:root` có comment và `--my-custom` của người dùng | comment và biến lạ **giữ nguyên**; chỉ biến có trong item đổi giá trị |
| E5 | `add --dry-run`, `--diff <path>` | in số biến sẽ thêm và diff; không ghi gì. (Diff của `cssVars.theme` hiển thị sai chỗ: một khối `.theme` trong `@layer base`; **bản ghi thật đúng** `@theme inline`. Không tin phần diff đó.) |
| E6 | `init -t vite -b radix -n app --preset a2r6bw ./item.json` (một lệnh) | **preset thắng item**: `--primary` vẫn là indigo của preset; chỉ biến preset không đặt (`--primary-text`) từ item vào được |
| E7 | `init --preset …` rồi `add ./item.json` | item ghi đè màu, **giữ** font (`Roboto Variable`), `--radius`, icon của preset |
| E8 | `add "data:application/json;base64,…"` | CLI chấp nhận (dry-run đúng 6 biến). **Không có trong tài liệu**, chỉ thử 1 lần: không dựa vào |
| E9 | file do `init` sinh | thụt dòng 4 dấu cách, nháy đơn trong font; công cụ sửa file phải giữ phong cách của file |

---

## 1. Trang builder

### 1.1 Mục tiêu và ranh giới
Nâng cấp `docs/preview/theme.html` thành app có thể chia sẻ và áp vào project. Giống `shadcn/create` ở chỗ: điều khiển bên trái, preview thật bên phải, mã ngắn trong URL, lệnh để chạy. Khác: chỉ màu; có audit contrast; xuất CSS/registry/DTCG.

### 1.2 Điều khiển

| Nhóm | Control | Ghi chú |
|---|---|---|
| Brand | slider hue 0–360 (bước 1) + ô số (bước 0.1) + nhãn `nameOfHue` (`40° coral · phụ, gần orange −12°`) | slider gộp một cập nhật mỗi frame |
| | 12 chip hue lõi + chip tên phụ (coral, carrot, …) | bấm = đặt hue |
| | κ 0.35–0.85 (bước 0.01) | mặc định 0.85 |
| Neutral | `neutral / cool / warm / auto` + "tuỳ chỉnh" (hue, chroma bậc 9, chroma dark riêng) | tuỳ chỉnh mở rộng được, ẩn mặc định |
| Bề mặt | `pageStep` 1 \| 2 | |
| Trạng thái | 4 ô hue (destructive, success, warning, info) + nút reset | hiện tên hue bên cạnh |
| Primary | `accessible` \| `vivid` | nhãn nói rõ vivid cần đổi 5 component sang `primary-text` (README) |
| Preset | 12 hue lõi, 12 devglow (kèm công tắc `darkChromaCap`) | **chọn preset = điền các control** (không phải tham chiếu): sau khi chọn vẫn chỉnh tiếp được |
| Preset shadcn | ô văn bản "mã preset shadcn (tuỳ chọn)" | chỉ để ghép lệnh §5; không giải mã |

Không có: radius, font, icon, style, base color (thuộc shadcn/create).

### 1.3 Preview bằng component shadcn thật

- **Dùng iframe, không dùng container cuộn.** Component Radix (Select, Dialog, Dropdown, Tooltip, Popover) **portal ra `document.body`**: theme áp vào một container (`applyThemeToRoot(theme, el)`) sẽ không tới phần portal, và `.dark` trên container không tới portal. Iframe có `:root` riêng nên đi đường `applyThemeToRoot(theme)` mặc định, đúng như ở app thật; đồng thời UI của builder không bị nhuộm theo theme người dùng chọn.
- Một route thứ hai `/preview.html?mode=light|dark` chứa app preview; builder cha nhúng **hai iframe** (light, dark) cạnh nhau và gửi cấu hình (object nhỏ, không phải `Theme`) bằng `postMessage`; mỗi iframe tự `buildTheme` + `applyThemeToRoot` (cache scale làm việc này ~1 ms). Chế độ "một khung lớn" cho màn hình hẹp.
- Nội dung preview: component thật sinh bằng `shadcn@4.23.0 add` (không viết lại): Button (mọi variant/size), Badge, Alert, Card, Input, Field + lỗi, Label, Checkbox, Switch, Radio, Select, Dropdown, Dialog, Tooltip, Tabs, Table, Progress, Slider, Sidebar; một dải 5 ô `chart-1…5` (không kéo `recharts`); các chỗ dùng `text-primary` (§12.1 SPEC) được đánh dấu để thấy khác biệt accessible/vivid.
- Bảng audit (nút "Contrast"): chạy **bảng cặp** của `test/pairs.ts` trên theme hiện tại (hiện 233 cặp), liệt kê cặp sát ngưỡng và cặp không gate. **Việc cần làm trước**: chuyển bảng cặp từ `test/pairs.ts` sang `src/audit.ts` (xuất từ package) để site và CLI dùng chung một nguồn; test import lại từ `src/`.

### 1.4 Xuất (tab dưới)
CSS (`toCss`, copy/tải), lệnh CLI (§3), URL registry (§4), DTCG JSON, JSON cấu hình. Mỗi tab có nút copy.

### 1.5 Stack và vị trí

**Đề xuất: `apps/site` trong repo này, Vite + React 19 + Tailwind v4 + shadcn `radix-nova`.** Đây đúng stack của `examples/vite-app` (Vite 8, React 19, Tailwind 4, TS 6) nên đã chứng minh chạy được với thư viện.

| Phương án | Ưu | Nhược |
|---|---|---|
| **A. `apps/site` trong repo (bun workspaces)** | một PR sửa thư viện + site + test; site luôn dùng đúng phiên bản (`workspace:*`); CI chung; registry/audit/codec dùng thẳng `src/` | `bun install` ở gốc kéo thêm dependency của site; cần tách rõ `files` của package để không phát hành site (đã có `files: [dist, NOTICE, LICENSE]`) |
| B. Repo riêng | repo thư viện gọn | đổi thư viện phải phát hành rồi nâng site; dễ lệch phiên bản; hai CI |

Chi tiết A: root `package.json` thêm `"workspaces": ["apps/*"]` (vẫn là package phát hành); `apps/site` là `private`; giữ `examples/vite-app` làm smoke tối giản cho người dùng (không gộp: site là sản phẩm, example là bằng chứng cài từ tarball).

Loại: Next (cần runtime hoặc export tĩnh nặng cho một trang), Astro (builder là một app tương tác duy nhất, không có lợi ích nội dung tĩnh). Routing: không cần router; trạng thái nằm trong query (§2).

### 1.5.1 Deploy tĩnh
`vite build` → thư mục tĩnh gồm `index.html`, `preview.html`, `assets/`, `r/*.json` (§4), `registry.json`. Chạy được trên GitHub Pages, Cloudflare Pages, Netlify, Vercel mà không cần server.
- **GitHub Pages** (repo `kachitaro/gennex-color`): miễn phí, cùng nơi với mã; URL `https://kachitaro.github.io/gennex-color/`; cần `base: "/gennex-color/"` và đường dẫn tương đối trong lệnh/registry. Workflow: `bun install → bun test → bun run build → actions/upload-pages-artifact → deploy-pages`.
- **Cloudflare Pages / Vercel**: domain gốc, headers tuỳ chỉnh (CORS, cache) dễ; có thể thêm function sau (§4.4).
- **URL là API công khai**: `…/r/theme-ember.json` sẽ nằm trong README người dùng. Chọn host/domain một lần, về sau không đổi (D14).
- CI hiện chưa có (`.github/` không tồn tại). Thêm: `test` + `build site` trên PR; deploy khi merge `main`.

---

## 2. Mã chia sẻ

### 2.1 Yêu cầu
(1) ngắn, dán được vào URL/lệnh, bấm đúp chọn được; (2) **tự chứa**: không tham chiếu thứ có thể đổi (tên preset devglow, mặc định); (3) ổn định qua phiên bản: một mã cũ giải mã ra **đúng cấu hình cũ** mãi mãi; (4) chuẩn tắc (một cấu hình = một mã); (5) từ chối mã sai thay vì đoán.

### 2.2 Hai lớp ổn định, hai cơ chế

| Lớp | Rủi ro | Cơ chế |
|---|---|---|
| **Định dạng mã** (cách đọc bit) | đổi layout làm mã cũ đọc sai | ký tự đầu = phiên bản định dạng (`a` = v1, như shadcn). Định dạng mới = ký tự mới; bộ giải mã giữ mọi phiên bản cũ |
| **Thuật toán sinh màu** (cùng cấu hình, màu đổi khi sửa `ANCHORS`, đường cong, tên ramp `cool/warm`) | mã cũ cho màu khác | trường **`epoch`** (3 bit) trong mã. `ENGINE_EPOCH` của gói tăng khi **bất kỳ** đầu ra của cấu hình có sẵn đổi. Mã có epoch ≠ epoch gói → CLI/builder **cảnh báo to** ("mã tạo bằng epoch 1, bản này là epoch 2, màu sẽ khác; cài `gennex-color@<phiên bản>` để tái tạo") và không im lặng |

Cam kết kèm theo: đổi đầu ra của cấu hình có sẵn = tăng `epoch` = tăng minor (trước 1.0) / major (từ 1.0); bắt buộc bởi **test golden** (§2.5). Không giữ nhiều thuật toán cùng lúc (đắt, không cần): muốn tái tạo màu cũ thì ghim phiên bản gói, CLI ghi phiên bản vào file (§3.5).

### 2.3 Bố cục (v1)

Chuỗi bit, MSB trước, bọc một bit sentinel `1` ở đầu (để không mất số 0 dẫn đầu), rồi mã hoá **base62** (như `toBase62` của shadcn, 0-9A-Za-z, không có `-_` nên bấm đúp chọn được). Mã = `a` + base62(payload).

| Trường | Bit | Giá trị |
|---|---|---|
| epoch | 3 | 0–7 |
| hue | 12 | 0–3599 = 0.0°–359.9° (bước 0.1°; 360 → 0) |
| κ lệch mặc định | 1 | 0 = 0.85; 1 = có trường κ |
| neutral | 3 | 0 neutral, 1 cool, 2 warm, 3 auto, 4 tuỳ chỉnh |
| pageStep | 1 | 0 → 1, 1 → 2 |
| primaryMode | 1 | 0 accessible, 1 vivid |
| statusMask | 4 | bit i = bật hue riêng của trạng thái i (destructive, success, warning, info) |
| κ | 6 | nếu cờ κ: 0–50 → 0.35 + 0.01·n |
| neutral tuỳ chỉnh | 38 | hue 12 · chroma bậc 9 (8 bit, bước 0.0005, 0–0.1275) · cờ + chromaDark 8 · cờ + canvas dark (8 bit, L 0.10 + 0.001·n) |
| status | 12 mỗi trường bật | hue 0.1° |

Độ dài (tính từ bố cục): chỉ hue = 25 bit + sentinel → **6 ký tự** (cùng cỡ `a2r6bw`); hue + κ + warm + vivid ≈ 7 ký tự; cấu hình đầy đủ (neutral tuỳ chỉnh + 4 hue trạng thái) = 117 bit → **21 ký tự**.

Quy tắc chuẩn tắc: mặc định của v1 bị **đóng băng theo phiên bản định dạng** (κ 0.85, neutral `neutral`, page 1, accessible, hue trạng thái 25/156/80/255); đổi mặc định = định dạng mới. Mọi số được làm tròn theo bước của trường trước khi mã hoá; `decode(encode(c)) = normalize(c)`; giải mã xong **mã hoá lại và so khớp** (từ chối mã không chuẩn tắc: padding thừa, cờ bật mà giá trị bằng mặc định). Preset devglow và preset hue lõi được **bung thành giá trị tường minh** lúc mã hoá (hue, κ, neutral tuỳ chỉnh), nên đồng bộ lại snapshot devglow không làm đổi mã cũ.

Không có checksum (tốn 1 ký tự; kiểm khoảng giá trị + chuẩn tắc đã bắt phần lớn lỗi gõ). Chốt ở D15.

### 2.4 URL và cờ
- Builder: `https://<host>/?c=<code>` (query, như `?preset=` của shadcn; chạy trên host tĩnh). Builder cũng đọc dạng đọc được `?hue=40&neutral=warm&primary=vivid` (và luôn ghi lại thành `?c=`).
- CLI/cờ tương đương 1–1: `--hue 40 --kappa 0.6 --neutral warm|cool|neutral|auto|<hue>:<chroma> --page 2 --primary vivid --status destructive=25,warning=70 --preset blue | --devglow ember [--dark-chroma-cap 0.06]` hoặc `--code <mã>`. Hai cách cho cùng cấu hình **phải** ra cùng mã (có test).
- Lệnh `gennex-color encode <cờ…>` → mã; `gennex-color decode <mã> [--json]` → cấu hình + epoch + cảnh báo.

### 2.5 Kiểm thử ổn định
`test/codes.golden.json`: danh sách `{ code, config, themeHash }` đã đóng băng (≥ 200 mục: 12+12 preset, lưới hue × κ × neutral × page × primary, các biên). Test: (a) mọi mã **giải mã ra đúng cấu hình ghi sẵn**; (b) `themeHash = sha256(toCss(buildTheme(config)))` không đổi trong cùng epoch. Test (b) đỏ khi ai đó sửa thuật toán mà quên tăng `ENGINE_EPOCH`. Cộng thêm: round-trip property trên lưới dày; mã sai (ký tự lạ, quá ngắn/dài, phiên bản lạ, ngoài khoảng, không chuẩn tắc) đều ném lỗi có thông điệp, không bao giờ trả cấu hình đoán.

---

## 3. CLI `gennex-color apply`

### 3.1 Giao diện

```
gennex-color apply [<code>] [flags]       # sửa file CSS của project shadcn
gennex-color encode <flags>               # in mã
gennex-color decode <code> [--json]       # in cấu hình, epoch, cảnh báo
gennex-color info [--json]                # đọc dấu trong project: mã/phiên bản đã áp
```

Cờ của `apply`: cấu hình (§2.4) · `--cwd <dir>` · `--css <path>` (bỏ qua `components.json`) · `--dry-run` (in diff, không ghi) · `--check` (thoát 1 nếu file sẽ đổi; cho CI) · `--print` (in CSS sẽ có ra stdout) · `--tokens all|shadcn` · `--force` · `--no-marker` · `--json` · `--yes`.
Mã thoát: 0 xong/không cần đổi; 1 `--check` có chênh lệch; 2 lỗi dùng/đọc file; 3 project không tương thích (Tailwind v3/hsl, `@theme` không inline có wrapper `hsl()`).

Đóng gói: `bin` trong **cùng package** (`dist/cli.mjs`, shebang), chỉ dùng `node:*` (`parseArgs`, `fs`) và code thư viện; thư viện không import CLI nên người dùng thư viện không phải trả giá. **Chưa chạy được bằng `npx` cho tới khi publish** (tên `gennex-color` còn trống trên npm: `npm view` trả 404); trước đó dùng `bunx ./gennex-color-<v>.tgz apply …`.

### 3.2 Tìm file CSS
1. `--css` nếu có.
2. `components.json` ở `--cwd` (mặc định thư mục hiện tại): `tailwind.css` (cách `shadcn` làm; đã thấy `"css": "src/index.css"`). Không có `components.json` → lỗi chỉ dẫn dùng `--css`.
3. Monorepo: chạy trong package có `components.json` hoặc `--cwd packages/ui`; không tự dò lên cha (tránh sửa nhầm).
Kiểm tra bắt buộc trước khi ghi: là file thường (không symlink ra ngoài `--cwd`), ≤ 2 MB, UTF-8, có `@import "tailwindcss"` hoặc `@theme`, `tailwind.config` rỗng/không có (v4). Không đáp ứng → thoát 3, không ghi.

### 3.3 Cái gì được phép đổi — "khối biến màu"
**Sở hữu** = đúng các tên biến của `TOKEN_NAMES` (52; hoặc 31 tên shadcn với `--tokens shadcn`). CLI chỉ chạm các khai báo **có tên đó** ở ba chỗ:

| Chỗ | Việc | Không đụng |
|---|---|---|
| mọi rule `:root` (kể cả trong `@layer base`) | đổi **giá trị** các `--<token>` đã có; thiếu thì chèn vào rule **cuối cùng** khớp, sau khai báo sở hữu cuối (hoặc cuối khối) | biến lạ (`--my-custom`, `--sidebar-width`, `--radius`, `--font-*`), comment, thứ tự, thụt dòng |
| mọi rule `.dark` (bộ chọn dark của project) | như trên với giá trị dark | như trên |
| `@theme inline` | đảm bảo có `--color-<token>: var(--<token>)` cho từng token sở hữu (sửa nếu giá trị khác, trừ xung đột bên dưới) | `--font-*`, `--radius-*`, `--spacing`, `--animate-*`, keyframes |

Không có `.dark` → nối khối mới sau `:root`. Không có `@theme inline` → chèn sau `@custom-variant`/`@import` cuối. Không có `:root` → nối cuối file (cách `shadcn` làm, E1).

**Không bao giờ**: sửa `--radius*` (radius thuộc preset shadcn, E7); thêm/xoá rule ngoài ba chỗ trên; format lại file; xoá biến/dòng của người dùng.

**Xung đột**: `@theme inline` có `--color-primary: var(--brand)` (người dùng trỏ chỗ khác) hoặc `@theme` không-inline → **bỏ qua + báo cáo**, chỉ sửa khi `--force`. `@import "gennex-color/css/*.css"` đã có → từ chối ("đang dùng CSS dựng sẵn; đổi import thay vì apply") trừ `--force`. Bộ chọn dark khác `.dark` (đọc `@custom-variant dark`) → dùng bộ chọn đó nếu là dạng `.x`/`[data-x]` đơn giản, ngược lại thoát 3.

### 3.4 Cách sửa: tách bước đọc và bước ghi
1. **Đọc**: dùng `postcss` chỉ để lấy **khoảng vị trí** (`source.start.offset`/`end.offset`) của các khai báo/rule đích. Parser thật xử lý comment, chuỗi, `url()`, `!important`, lồng nhau.
2. **Ghi**: tự **ghép văn bản** theo các khoảng đó (thay giá trị, chèn dòng); mọi byte ngoài các khoảng bị sửa là byte cũ **bằng cấu trúc** (không có bước stringify lại). Chèn dòng theo phong cách file: thụt dòng, `--x: v;` có/không dấu cách (suy từ khai báo gần nhất), kiểu xuống dòng LF/CRLF, BOM, dòng cuối.
3. **Xác minh trước khi ghi**: parse lại văn bản mới (phải hợp lệ), kiểm "ngoài vùng sở hữu byte không đổi" (so tiền tố/hậu tố quanh từng khoảng), kiểm lần áp thứ hai không đổi gì (idempotent). Một kiểm tra hỏng → **không ghi**, thoát 2, thông điệp nêu kiểm tra nào.
4. **Ghi nguyên tử**: file tạm cùng thư mục + `rename`, giữ quyền file; không ghi nếu nội dung không đổi (không chạm mtime).

Phụ thuộc: `postcss` (MIT, ~220 KB, deps `nanoid`, `picocolors`, `source-map-js`; chính CLI `shadcn` cũng dùng). Phương án thay: bộ quét tự viết ~150 dòng (không dependency, rủi ro tự sai ở comment/chuỗi lồng nhau) hoặc tách `gennex-color-cli` (thư viện giữ 1 dependency). Chốt ở D16.

### 3.5 Dấu trong file (tuỳ chọn, mặc định bật)
Một comment một dòng ở đầu rule `:root` đầu tiên: `/* gennex-color 0.2.0 · a2K9xB */`. Cho `info`, `--check` (so mã/phiên bản) và cảnh báo epoch. Chỉ là comment; xoá đi không ảnh hưởng; `--no-marker` để tắt. Chốt ở D17.

### 3.6 `--dry-run` và báo cáo
In diff thống nhất (dòng đổi có `-`/`+`, chỉ các dòng bị chạm) và bảng tóm tắt: số biến đổi/thêm theo khối, xung đột bỏ qua, tên file; cuối cùng kết quả audit **trên theme sắp áp** (số cặp đạt/tổng, cặp sát ngưỡng). Không bao giờ in "thành công" khi bỏ qua xung đột mà không nói. `--json` cho CI.

---

## 4. Registry shadcn

### 4.1 Preset cố định → item tĩnh
Với mỗi preset (12 hue lõi + 12 devglow, 24) sinh `r/theme-<tên>.json`:

```json
{ "$schema": "https://ui.shadcn.com/schema/registry-item.json",
  "name": "theme-ember", "type": "registry:theme", "title": "ember",
  "description": "gennex-color · devglow ember · accessible",
  "cssVars": { "theme": { "color-primary-hover": "var(--primary-hover)", … 21 token mở rộng },
               "light": { "background": "oklch(…)", … 52 token },
               "dark":  { … 52 token } },
  "meta": { "gennex": { "code": "a…", "epoch": 1 } } }
```
cùng `registry.json` (liệt kê item). **Không** có `--radius` trong `cssVars` (E2: có radius thì shadcn thêm cả thang `--radius-*`, ghi đè radius của preset). Chỉ 21 token mở rộng cần `cssVars.theme` (31 token shadcn đã có ánh xạ `@theme inline`; đã thấy shadcn vẫn thêm `--color-primary` — vô hại, cùng giá trị).

Cách người dùng cài (đã kiểm E2/E3/E4/E7 với file cục bộ):
```
npx shadcn@latest add https://<host>/r/theme-ember.json
# hoặc đăng ký namespace trong components.json: "registries": { "@gennex": "https://<host>/r/{name}.json" }
npx shadcn@latest add @gennex/theme-ember
```
Hành vi đã đo: sửa tại chỗ khối có sẵn, giữ biến lạ và comment, không nhân đôi khối; hỗ trợ `--dry-run`. Giới hạn so với `gennex-color apply`: chỉ ghi các biến có trong item (không xoá), không có audit/dấu/xác minh, không biết bộ chọn dark khác `.dark`, xuất theo định dạng riêng của shadcn.

Test cho item (§6F): hợp lệ theo schema, `cssVars` khớp từng giá trị `toCss`, xác định (build hai lần cho cùng byte), `shadcn add --dry-run` báo đúng số biến.
Chưa kiểm: `shadcn add kachitaro/gennex-color/theme-ember` (registry GitHub, không cần host). Tài liệu yêu cầu `registry.json` ở gốc repo và file nguồn tồn tại; item chỉ có `cssVars` (không `files`) có hợp lệ hay không **chưa thử** — cần thử khi có repo (§10).

### 4.2 Theme tuỳ ý có cần server không?
**Không cần cho v1.** Lý do và các đường:

| Đường | Cần server? | Trạng thái |
|---|---|---|
| `gennex-color apply <mã>` (CLI giải mã tại chỗ) | không | **chính**; tương đương `shadcn apply <preset>` (CLI tự giải mã) |
| `gennex-color registry-item <mã> > t.json && shadcn add ./t.json` | không | thêm lệnh nhỏ; dùng `toRegistryItem` |
| Builder tải/copy JSON hoặc CSS | không | có sẵn ở §1.4 |
| `shadcn add "data:application/json;base64,…"` | không | **chạy được ở 4.23.0 (E8) nhưng không có tài liệu**: không đưa vào UI chính |
| `shadcn add https://<host>/r/c/<mã>.json` | **có** (hàm biên) | chỉ thêm khi cần "một dòng giống `create`". Hàm thuần (giải mã + `buildTheme` + `toRegistryItem`), ~1 ms, phản hồi bất biến theo (mã, epoch) nên cache vĩnh viễn; chạy được trên Cloudflare Pages Functions/Vercel/Netlify. Host tĩnh thuần (GitHub Pages) **không** làm được |

Host tĩnh không đọc được query (`?c=`) để trả JSON khác nhau, nên đường URL-có-mã bắt buộc có hàm. Chốt ở D19.

---

## 5. Quy trình cùng `shadcn/create`

**Thứ tự bắt buộc: preset shadcn trước, màu của ta sau.** E6 cho thấy nếu gộp vào một lệnh `init --preset … <item>` thì preset ghi đè item; E7 cho thấy áp item sau đó chỉ đổi màu và giữ font/radius/icon.

```sh
# 1) shadcn tạo project (preset a2r6bw: font, radius, icon, style; `create` là alias của `init`)
npx shadcn@latest init -t vite -b radix -n my-app --preset a2r6bw
cd my-app
# 2) màu của gennex-color (mã từ builder)
npx gennex-color apply a2K9xB          # thêm --dry-run để xem trước
```
Builder dựng sẵn cả hai dòng (ô "mã preset shadcn" chỉ được điền vào dòng 1; có thể để trống).

Các điểm cần nói rõ trong README/builder:
- Mọi màu của preset shadcn (`theme`, `baseColor`, `chartColor`) bị ghi đè; font, radius, icon, style giữ nguyên.
- `shadcn apply <preset>` về sau sẽ ghi lại biến màu → chạy lại `gennex-color apply`, hoặc dùng `shadcn apply <preset> --only font` (tuỳ chọn có trong CLI) khi chỉ cần font. `gennex-color apply --check` trong CI báo khi màu lệch khỏi mã ghi trong dấu.
- `vivid` cần đổi 5 component sang `text-primary-text` (lệnh `perl` ở README); `apply` in nhắc khi mã có vivid và phát hiện các file đó trong `components.json` aliases.
- Không bọc `shadcn` (không có `gennex-color create`): tránh phụ thuộc vào cờ của CLI khác; có thể thêm sau.

---

## 6. Danh sách test cho CLI (ưu tiên: không phá file CSS của người dùng)

**A. Mã (thuần)** — round-trip lưới dày; chuẩn tắc (một cấu hình một mã; cờ bật mà bằng mặc định bị từ chối); golden §2.5; lỗi: ký tự ngoài base62, rỗng, quá ngắn/dài, phiên bản lạ, ngoài khoảng, epoch lạ, thừa bit; cờ ≡ mã (`--hue 40 --neutral warm` ra đúng mã của `--code`); preset bung tường minh (đổi snapshot devglow không đổi mã).

**B. Bộ sửa CSS (thuần, chuỗi → chuỗi)**, với kho fixture:
1. **File thật do `shadcn init` sinh** (≥ 3 preset khác nhau, commit nguyên văn; có script sinh lại và job định kỳ để bắt thay đổi định dạng của shadcn).
2. Thiếu từng phần: không có sidebar/chart; không có `.dark`; không có `@theme inline`; không có `:root`; file chỉ có `@import`; file rỗng.
3. Nhiều khối: `:root` hai lần; `:root` trong `@layer base`; `:root, :host`; `.dark` lồng trong `@media`; `html.dark`.
4. Cú pháp khó: comment chứa `}` và `--primary: x`; chuỗi chứa `{}`/`;`; `url(data:…;base64,…)`; `!important`; biến giá trị lạ (`--x: {a:b}`); selector/biến unicode; CSS đã minify một dòng; dòng rất dài.
5. Định dạng: thụt 2/4/tab; CRLF; BOM; không có dòng cuối; nháy kép/đơn; `--x:v` không dấu cách.
6. **Tính bất biến**: (a) **ngoài vùng sở hữu byte giữ nguyên** — với mỗi fixture, xoá các khai báo sở hữu khỏi bản gốc và bản mới, hai văn bản phải **bằng nhau từng byte** (bắt mọi thay đổi ngoài ý muốn); (b) idempotent: áp lần hai không đổi; (c) áp A rồi B cho cùng kết quả như áp B (không tích luỹ, không nhân đôi khối, kích thước ổn định); (d) áp rồi `--check` thoát 0; (e) mỗi mã áp rồi parse lại hợp lệ.
7. Biến lạ giống tên: `--primary-brand`, `--color-primary-brand`, `--sidebar-width`, `--chart-foo` không bị chạm; `--radius`, `--font-*` không bị chạm.
8. Xung đột: `--color-primary: var(--brand)`, `@theme` không inline, giá trị hsl/triplet (Tailwind v3) → bỏ qua có báo cáo / thoát 3, **không ghi một phần**.
9. Lỗi: dấu ngoặc không cân bằng, file nhị phân, UTF-16, > 2 MB → thoát 2, file không đổi (so hash và mtime).
10. **Fuzz bảo toàn**: kho CSS thật (các file CSS trong registry shadcn, mẫu Tailwind, vài file Bootstrap/Normalize) + ngẫu nhiên chèn khối sở hữu: kết quả hoặc ghép đúng (bất biến 6a) hoặc dừng không ghi.

**C. CLI (chạy bản dựng thật trên bản sao trong thư mục tạm)**
- `--dry-run`: không ghi (hash + mtime), in diff chỉ gồm dòng bị chạm, thoát 0; `--check`: thoát 1/0 đúng; `--print`; không đổi gì → "đã cập nhật", không chạm mtime.
- Tìm file: từ `components.json`; `--css`; `--cwd`; bố cục monorepo; thiếu `components.json`; đường dẫn không tồn tại; symlink ra ngoài `--cwd`; Next (`app/globals.css`) và Vite (`src/index.css`).
- Ghi: nguyên tử (không để lại file tạm kể cả khi lỗi), giữ quyền file/EOL/BOM; file chỉ đọc → lỗi, không ghi một phần; hai tiến trình đồng thời không làm hỏng file.
- Mã thoát 0/1/2/3 đúng từng tình huống; `--json` ổn định (schema có test); `encode`/`decode`/`info`.
- **Không mạng**: chạy với mạng bị chặn, CLI vẫn xong (không bao giờ gọi mạng).
- Không chạy lệnh ngoài, không `eval`; `--css`/`--cwd` chặn path traversal.

**D. Tích hợp với shadcn (job riêng, cần mạng)**: `shadcn init --preset … ` → `gennex-color apply` → `vite build` (Tailwind v4 thật) → CSS build chứa đủ giá trị, font/radius của preset còn nguyên (E7); thử thêm `shadcn add button` sau apply (không phá màu); `shadcn apply <preset> --only font` giữ màu; `shadcn apply <preset>` ghi đè màu → `gennex-color apply --check` thoát 1. Bắt buộc ghim `shadcn@4.23.0` và chạy thêm với `@latest` hằng tuần để sớm thấy đổi định dạng.

**E. Registry item**: hợp lệ theo schema (`shadcn registry validate`); `cssVars` khớp `toCss` từng giá trị; không có `--radius`; xác định; `shadcn add ./item --dry-run` đúng số biến (E5); item `@gennex/…` qua namespace cục bộ.

**F. Site/builder**: round-trip trạng thái ↔ URL; mọi tổ hợp điều khiển ra mã hợp lệ; iframe nhận cấu hình và render (một Playwright/headless Chrome smoke); bảng audit của builder = bảng của test (cùng `src/audit.ts`); build tĩnh không gọi mạng.

---

## 7. Việc cần làm trước (thư viện)
1. `src/audit.ts`: chuyển bảng cặp từ `test/pairs.ts` (xuất qua package).
2. `src/code.ts`: `encodeConfig`/`decodeConfig`, `ENGINE_EPOCH`, kiểu `ThemeConfig` (cấu hình tường minh, gồm preset đã bung), `configToThemeOptions`.
3. `src/registry.ts`: `toRegistryItem(theme, meta)`; `scripts/build-registry.ts` sinh `registry.json` + `r/*.json`.
4. Test golden mã + hash theme.

## 8. Lộ trình đề xuất
| Bước | Nội dung | Tiêu chí xong |
|---|---|---|
| 5a | §7 (audit, mã, registry item, golden) | test xanh; `bun run build` sinh `r/*.json` hợp lệ |
| 5b | CLI `apply`/`encode`/`decode`/`info` + bộ test §6 A–C, E | fuzz bảo toàn xanh; `shadcn init --preset` → `apply` → build chạy |
| 5c | `apps/site` (iframe preview, điều khiển, xuất) | builder ↔ URL ↔ CLI cho cùng màu (test chéo) |
| 5d | CI + deploy tĩnh + job tích hợp shadcn | URL registry công khai hoạt động từ máy sạch |
| sau | hàm biên `/r/c/<mã>.json`, `gennex-color create`, P3 | theo nhu cầu |

---

## 9. Quyết định cần bạn chốt

| # | Quyết định | Phương án | Khuyến nghị |
|---|---|---|---|
| D12 | Chỗ đặt site | **A. `apps/site` trong repo** / B. repo riêng | A |
| D13 | Stack + preview | **Vite + React + Tailwind v4 + shadcn `radix-nova`; preview bằng 2 iframe** / preview trong cùng trang (portal Radix hỏng theme) | iframe |
| D14 | Host + domain (URL registry là API công khai, không đổi được về sau) | GitHub Pages `kachitaro.github.io/gennex-color` / Cloudflare Pages / Vercel / domain riêng | tuỳ bạn; nếu muốn có hàm biên sau này chọn Cloudflare Pages hoặc Vercel ngay từ đầu |
| D15 | Mã: bố cục §2.3 (epoch 3 bit, base62, tự chứa, mặc định đóng băng), **có checksum không** | không checksum (6–21 ký tự) / thêm 1 ký tự checksum | không checksum |
| D16 | Sửa CSS | **`postcss` làm dependency (chỉ đọc vị trí) + tự ghép chuỗi** / bộ quét tự viết / tách `gennex-color-cli` | postcss, cùng package |
| D17 | `apply` mặc định | **52 token + dấu comment `gennex-color <ver> · <mã>`** / chỉ 31 token shadcn / không dấu | 52 + dấu; `--tokens shadcn`, `--no-marker` để tắt |
| D18 | Xung đột (`--color-primary: var(--brand)`…) | **bỏ qua + báo, `--force` mới ghi đè** / luôn ghi đè | bỏ qua + báo |
| D19 | Theme tuỳ ý qua URL registry | **không server ở v1 (CLI + tải JSON)** / hàm biên `/r/c/<mã>.json` ngay | không server ở v1 |
| D20 | Policy epoch | **đổi đầu ra của cấu hình có sẵn ⇒ tăng epoch ⇒ minor/major; không giữ thuật toán cũ** / giữ nhiều epoch song song | tăng epoch, không giữ |
| D21 | Publish npm (CLI chỉ `npx` được sau đó) | publish `gennex-color` (tên còn trống) trước 5b / sau 5c | trước 5c, để thử `npx` thật |
| D22 | Phạm vi hỗ trợ project | Tailwind v4 + `components.json` + `.dark` (v1) / thêm Tailwind v3 (hsl) | chỉ v4; v3 thoát 3 có hướng dẫn |

---

## 10. Chưa kiểm, giới hạn
- Nội dung và control thật của `ui.shadcn.com/create`: không đọc được (client-render). Thiết kế §1 theo CLI và mô tả trong tài liệu, không bám UI đó.
- `shadcn apply <preset>` trên file **đã có** `:root` của ta: chỉ thử trên file chưa có `:root` (E1, nối khối mới). Từ E3/E4 suy ra nó sẽ ghi đè tại chỗ nhưng chưa xác nhận.
- Registry GitHub (`add kachitaro/gennex-color/<item>`) với item chỉ có `cssVars`; mẫu `{name}` trong namespace với tên có `/`; `registry validate` trên item không có `files`.
- E8 (`data:` URL) chỉ chạy 1 lần, không tài liệu.
- Tailwind v3/hsl, monorepo thật, Windows/CRLF: có trong danh sách test, chưa có fixture.
- Số đo kích thước `postcss` (220 KB) lấy từ `npm view`, chưa đo trong gói đã dựng.
- Mọi con số độ dài mã (§2.3) tính từ bố cục, chưa cài bộ mã hoá.
