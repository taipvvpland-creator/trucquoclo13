# TAIEMCHIA SEBDS — Bản đồ dự án căn hộ trục QL13

Website tra cứu 22 dự án căn hộ dọc Quốc Lộ 13 (Thủ Đức → Thuận An, Bình Dương): bản đồ tương tác đồng bộ theo scroll, lọc theo khu vực/trạng thái, đơn giá, chủ đầu tư, nút liên hệ Zalo/gọi điện.

## Nền bản đồ

Dùng **OpenStreetMap** (qua thư viện Leaflet + tile nền tối của CARTO) — miễn phí hoàn toàn, không cần đăng ký tài khoản, không cần token/API key, không giới hạn lượt xem, không rủi ro phát sinh phí. Không cần cấu hình gì thêm cho phần bản đồ.

## Việc cần hoàn tất trước khi deploy (checklist)

- [ ] **Số điện thoại/Zalo thật**: sửa trong [`public/js/config.js`](public/js/config.js) — hiện đang là số giả `0900000000`.
- [ ] **Toạ độ 22 dự án**: `data/projects.json` — các dự án có `"coordConfidence": "estimated"` là vị trí ước lượng theo khu vực/tuyến đường, **chưa xác minh chính xác**, cần đối chiếu lại (xem mục "Xác minh vị trí" bên dưới). 4 dự án có `"coordConfidence": "landmark"` (Urban Green, Sky Solis, Norton Park, Sky Venue) đã neo theo landmark thật (Lotte Mart, Aeon Mall, Sân Golf Sông Bé...) nên độ tin cậy cao hơn nhưng vẫn nên kiểm tra lại.
- [ ] Test chạy local trước khi deploy (xem mục "Chạy thử local").

## Cấu trúc project

```
server.js           # Express server: serve static + API /api/projects
data/projects.json  # Dữ liệu 22 dự án (sửa trực tiếp file này để cập nhật giá/trạng thái)
public/              # Frontend tĩnh
  index.html
  css/style.css
  js/app.js          # Logic bản đồ + scroll-sync + filter
  js/config.js        # Số điện thoại/Zalo
```

## Chạy thử local

Máy dùng để code hiện **chưa cài Node.js** nên tôi chưa tự chạy thử được. Cần bạn cài Node.js (bản LTS tại [nodejs.org](https://nodejs.org)) trên máy, sau đó:

```bash
npm install
npm start
```

Mở `http://localhost:3000` để xem.

## Xác minh vị trí 22 dự án

Cách nhanh nhất: mở web sau khi chạy local (hoặc sau khi deploy), zoom vào từng dự án có nhãn "Vị trí đang xác minh" (viền ghim nét đứt trên bản đồ), so với vị trí thật bạn biết ngoài đời/trên Google Maps. Nếu lệch, sửa 2 giá trị `lat`/`lng` của dự án đó trong `data/projects.json` rồi lưu — không cần sửa code khác.

## Đẩy code lên GitHub

```bash
git init
git add .
git commit -m "Initial commit: QL13 project map"
git branch -M main
git remote add origin <URL_REPO_GITHUB_CUA_BAN>
git push -u origin main
```

## Deploy lên Hostinger (Node.js App)

Áp dụng nếu gói Hostinger có mục **Node.js App** trong hPanel (Cloud/Business hosting):

1. **hPanel** → **Advanced** → **Node.js** → **Create Application**.
2. Chọn Node.js version ≥ 18, trỏ **Application root** vào thư mục chứa code (sau khi upload hoặc kết nối Git).
3. **Application startup file**: `server.js`.
4. Kết nối Git: Hostinger hỗ trợ deploy trực tiếp từ GitHub repo (mục **Git** trong hPanel) — trỏ vào repo + branch `main`, mỗi lần push code sẽ có nút "Pull & Deploy" để cập nhật.
5. Bấm **NPM Install** trong giao diện Node.js App để cài dependencies, sau đó **Restart**.
6. Trỏ domain của bạn vào ứng dụng Node.js này (mục **Domains** trong cùng trang Node.js App).

Nếu gói Hostinger là **VPS**, quy trình khác (cần SSH, PM2, Nginx reverse proxy) — báo tôi để tôi viết hướng dẫn riêng.

## Cập nhật dữ liệu dự án sau này

Sửa trực tiếp `data/projects.json` (giá, trạng thái, thêm dự án mới...) → commit → push → "Pull & Deploy" lại trên Hostinger. Không cần biết code, chỉ cần sửa đúng định dạng JSON hiện có.
