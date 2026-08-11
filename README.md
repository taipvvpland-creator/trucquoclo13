# TAIEM — Bản đồ dự án căn hộ trục QL13

Website tra cứu 22 dự án căn hộ dọc Quốc Lộ 13 (Thủ Đức → Thuận An, Bình Dương): bản đồ tương tác đồng bộ theo scroll, lọc theo khu vực/trạng thái, đơn giá, chủ đầu tư, nút liên hệ Zalo/gọi điện.

## Nền bản đồ

Dùng **OpenStreetMap** (qua thư viện Leaflet + tile nền sáng "Voyager" của CARTO, hiển thị rõ tên đường/khu vực) — miễn phí hoàn toàn, không cần đăng ký tài khoản, không cần token/API key, không giới hạn lượt xem, không rủi ro phát sinh phí. Không cần cấu hình gì thêm cho phần bản đồ.

## Việc cần hoàn tất trước khi deploy (checklist)

- [x] Số điện thoại/Zalo: đã gắn `0909455126` trong [`public/js/config.js`](public/js/config.js).
- [ ] **Toạ độ 22 dự án**: dùng công cụ `/admin.html` (xem mục bên dưới) để kéo từng ghim về đúng vị trí — hiện phần lớn vẫn đang ở mức `"estimated"` (ước lượng, chưa xác minh).
- [ ] **Đặt `ADMIN_PASSWORD`** trong `.env` (local) và trong Environment Variables trên nơi deploy — bắt buộc phải có thì `/admin.html` mới lưu được, xem mục "Công cụ chỉnh vị trí dự án".
- [ ] Test chạy local trước khi deploy (xem mục "Chạy thử local").

## Cấu trúc project

```
server.js            # Express server: /api/projects, /api/admin/save-coords
data/projects.json   # Dữ liệu 22 dự án (sửa trực tiếp để cập nhật giá/trạng thái)
public/
  index.html          # Trang chính
  admin.html           # Công cụ kéo-thả chỉnh toạ độ (không public link, vào bằng URL trực tiếp)
  css/style.css        # Design tokens + giao diện trang chính
  css/admin.css         # Giao diện riêng cho admin.html
  js/app.js            # Logic bản đồ + scroll-sync + filter (trang chính)
  js/admin.js           # Logic kéo-thả + lưu toạ độ (admin.html)
  js/config.js          # Số điện thoại/Zalo
```

## Chạy thử local

Máy dùng để code hiện **chưa cài Node.js** nên tôi chưa tự chạy thử được. Cần bạn cài Node.js (bản LTS tại [nodejs.org](https://nodejs.org)) trên máy, sau đó:

```bash
npm install
cp .env.example .env
# mở .env, đổi ADMIN_PASSWORD thành mật khẩu riêng của bạn
npm start
```

Mở `http://localhost:3000` để xem trang chính, `http://localhost:3000/admin.html` để chỉnh toạ độ.

## Công cụ chỉnh vị trí dự án (`/admin.html`)

Trang riêng để tự tay đặt lại toạ độ chính xác cho từng dự án — không cần sửa file JSON thủ công:

1. Mở `<domain-của-bạn>/admin.html` (trang này không có link ở đâu trên site chính, chỉ vào được khi biết đúng URL).
2. Nhập **mật khẩu admin** (giá trị bạn đặt ở `ADMIN_PASSWORD`) vào ô góc trên phải.
3. Bên trái là danh sách 22 dự án, bên phải là bản đồ với ghim của từng dự án ở vị trí hiện tại.
4. **Kéo ghim** trên bản đồ tới đúng vị trí thực tế của dự án đó (bấm vào tên dự án ở sidebar để bản đồ tự bay tới ghim đó cho dễ tìm). Ghim vừa kéo sẽ đổi màu (đang chờ lưu).
5. Kéo xong hết các dự án cần sửa → bấm **Lưu tất cả** (góc trên phải, hiện số lượng thay đổi chưa lưu). Vị trí được ghi thẳng vào `data/projects.json` trên server và đánh dấu `"coordConfidence": "verified"`.
6. Muốn huỷ 1 ghim vừa kéo (chưa lưu) → bấm "Đặt lại vị trí cũ" ngay dưới dự án đó trong sidebar.

Lưu ý: nếu chạy trên Render, mỗi lần deploy lại (push code mới) sẽ dùng lại file `data/projects.json` **đã có trong repo** — nên sau khi chỉnh xong trên `/admin.html`, nhớ `git pull` từ trên server xuống máy (hoặc tôi lấy giúp) rồi `git add/commit/push` lại để toạ độ mới không bị mất khi deploy lần sau.

## Đẩy code lên GitHub

```bash
git init
git add .
git commit -m "Initial commit: QL13 project map"
git branch -M main
git remote add origin <URL_REPO_GITHUB_CUA_BAN>
git push -u origin main
```

## Deploy lên Render (miễn phí, không cần thẻ)

1. Vào [render.com](https://render.com) → **Sign up with GitHub**.
2. **New +** → **Web Service** → chọn repo GitHub của bạn.
3. Cấu hình: **Region** Singapore, **Branch** `main`, **Build Command** `npm install`, **Start Command** `npm start`, **Instance Type** Free.
4. Mục **Environment Variables** → thêm `ADMIN_PASSWORD` = mật khẩu bạn chọn.
5. **Create Web Service** → đợi build xong sẽ có link `https://<tên>.onrender.com`.

Gói free sẽ "ngủ" sau 15 phút không ai truy cập, lần vào đầu tiên sau đó sẽ chậm khoảng 30–50 giây.

## Cập nhật dữ liệu dự án sau này

- **Giá / trạng thái / thêm dự án mới**: sửa trực tiếp `data/projects.json` → commit → push → Render tự deploy lại.
- **Toạ độ**: dùng `/admin.html` như hướng dẫn ở trên, rồi đồng bộ lại vào repo (xem lưu ý cuối mục đó).
