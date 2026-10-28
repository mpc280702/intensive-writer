# Intensive Writer — bảo mật và triển khai

## Các phần đã sửa trong nhánh này

- Trang gốc `/` của GitHub Pages chuyển hướng tới `/web/` thay vì hiển thị README.
- Gọi Claude đi qua backend; frontend không còn lưu/ gửi `ANTHROPIC_API_KEY`.
- Admin đăng nhập bằng email/mật khẩu do máy chủ cấu hình; không còn PIN mặc định `admin123`.
- Tiến độ học viên (`iw:stats`, `iw:attempt:*`, `iw:explore:*`) được lưu cục bộ trước và đồng bộ lên PostgreSQL khi đăng nhập.
- Dữ liệu local được tách namespace theo tài khoản; khi cloud save thất bại, bản nháp giữ lại và hiển thị “Kept locally — waiting to sync.”
- Đề bài và Ideas Bank có thể được đồng bộ chung từ server; chỉ admin được ghi nội dung khóa học.
- Admin có thể xem các bài viết đã đồng bộ từ database.
- Renderer chỉ tạo list khi có marker danh sách rõ ràng; các đoạn văn thường vẫn là paragraph.
- Feedback chỉ được gắn với phiên bản văn bản đã phân tích; thống kê lỗi tính từ feedback hiện có để tránh cộng lặp.

## Triển khai

### 1) Cần chuẩn bị

- Node.js 20+
- PostgreSQL (ví dụ Supabase/Neon hoặc PostgreSQL managed)
- API key Anthropic (nếu muốn dùng AI qua server)
- Một host chạy Node.js cho backend
- GitHub Pages cho frontend (hoặc phục vụ frontend cùng origin với API)

### 2) Cấu hình backend

1. Sao chép `.env.example` thành `.env` trên máy chạy backend.
2. Điền `DATABASE_URL` và bật `DATABASE_SSL=true` nếu nhà cung cấp database yêu cầu TLS.
3. Điền `ADMIN_EMAIL` và mật khẩu mạnh `ADMIN_PASSWORD` (tối thiểu 12 ký tự). Khi database khởi tạo lần đầu, server tạo admin nếu email đó chưa tồn tại.
4. Điền `ANTHROPIC_API_KEY` ở Environment Variables của host, không đưa khóa vào code hoặc trình duyệt.
5. Đặt `ALLOWED_ORIGINS=https://mpc280702.github.io` cộng với các origin phát triển cần thiết. Đây là origin, không bao gồm `/intensive-writer/`.
6. Triển khai lệnh `npm install` và `npm start`. Backend tự tạo các bảng từ `database/schema.sql`.
7. Mở `https://YOUR-API-HOST/api/health` để kiểm tra `databaseConfigured` và `aiConfigured`.

Nếu muốn học viên tự tạo tài khoản, bật `ALLOW_STUDENT_SIGNUP=true` ở backend và đổi `allowStudentSignup: true` trong `shared/js/config.js`. Cả hai cờ đều phải bật. Nếu không, đăng ký công khai sẽ bị từ chối. Bản này chưa có xác thực email hoặc quy trình quên mật khẩu.

### 3) Cấu hình frontend

Mở `shared/js/config.js` và đặt `apiBaseUrl` thành URL HTTPS của API, ví dụ `https://YOUR-API-HOST.onrender.com`. Chỉ URL công khai của backend được đặt trong file này; tuyệt đối không đặt database password hay AI key vào đây.

GitHub Pages chỉ phục vụ frontend tĩnh. Backend và PostgreSQL phải được triển khai riêng. Có thể chạy toàn bộ dự án bằng `npm install` và `npm start` ở local; khi chưa có database, ứng dụng vẫn mở ở chế độ local/demo nhưng tài khoản, cloud sync và server AI sẽ không hoạt động.

Đăng nhập không có database bị khóa mặc định để tránh tài khoản demo xuất hiện trên một host public. Chỉ phục vụ smoke test localhost khi đặt `ENABLE_LOCAL_DEMO_AUTH=true` cùng email/mật khẩu demo riêng trong `.env`; tuyệt đối không bật cờ này trên môi trường public.

### 4) Cookie và domain

Backend dùng session cookie `HttpOnly`. Khi frontend ở `github.io` và API ở một domain khác, cookie cross-site có thể bị chặn bởi chính sách quyền riêng tư của trình duyệt. Cách triển khai đáng tin cậy hơn là dùng custom domain để frontend và API cùng site, hoặc phục vụ frontend từ chính Node server.

### 5) Dữ liệu và khôi phục

- Người dùng chưa đăng nhập: tiến độ chỉ tồn tại trên trình duyệt hiện tại.
- Người dùng đã đăng nhập và backend hoạt động: bản nháp được lưu trước ở thiết bị rồi đồng bộ lên database.
- Khi thấy “Kept locally — waiting to sync.”, đừng xóa dữ liệu trang hoặc browser storage cho đến khi đồng bộ thành công.
- File backup hiện tại chủ yếu xuất nội dung đề và ý tưởng từ trang Admin; hãy sao lưu database riêng trước khi vận hành thật.
- Nếu khóa API từng được nhập ở frontend hoặc đưa vào repository, hãy thu hồi và tạo khóa mới ngay.

### 6) Kiểm thử trước khi đưa cho học viên

1. Đăng nhập admin, thêm/sửa đề hoặc ý tưởng, sau đó mở bằng tài khoản học viên khác.
2. Học viên viết, tải lại trang, đăng xuất và đăng nhập lại để kiểm tra khôi phục.
3. Tắt mạng trong lúc nhập bài; xác nhận thông báo “Kept locally” xuất hiện khi đồng bộ thất bại, rồi bật mạng để thử lại.
4. Kiểm tra AI request không chứa khóa bí mật trong DevTools.
5. Kiểm tra account thường không mở được API admin/submissions.
