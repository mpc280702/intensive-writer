# Hướng Dẫn Sử Dụng XAMPP MySQL & phpMyAdmin Cho Intensive Writer

Hệ thống **Intensive Writer** đã được tích hợp toàn diện với Cơ sở Dữ liệu **MySQL của XAMPP**.

---

## 1. Thông Tin Cấu Hình (.env)

Hệ thống kết nối tự động với XAMPP theo các thông số chuẩn:
- **Host**: `localhost`
- **Port**: `3306` (Cổng mặc định của MySQL trong XAMPP)
- **User**: `root`
- **Password**: *(để trống theo mặc định của XAMPP)*
- **Database**: `intensive_writer`

---

## 2. Cách Khởi Động & Đồng Bộ Dữ Liệu

1. **Mở XAMPP Control Panel**:
   - Đường dẫn cài đặt trên máy của bạn: `E:\MP\XAMPP MP\xampp-control.exe`
2. **Bấm "Start" ở 2 mục**:
   - **Apache** (để truy cập phpMyAdmin)
   - **MySQL** (để lưu trữ dữ liệu)
3. **Tự Động Tạo CSDL & Bảng**:
   - Khi MySQL bật, server Node.js sẽ **tự động phát hiện, tạo database `intensive_writer`** và chạy file [schema_mysql.sql](file:///e:/MP/web%20mp/database/schema_mysql.sql).
   - Tự động tạo sẵn tài khoản Admin: `admin@example.com` / `admin12345678`.
   - Bạn không cần phải restart server thủ công vì server có tính năng tự động nhận diện kết nối lại trong vòng 5 giây!

---

## 3. Xem Dữ Liệu Trên phpMyAdmin

Khi Apache & MySQL trong XAMPP đang chạy:
1. Mở trình duyệt và truy cập: [http://localhost/phpmyadmin](http://localhost/phpmyadmin)
2. Chọn database: **`intensive_writer`**
3. Các bảng dữ liệu:
   - **`app_users`**: Quản lý tài khoản Admin và Học viên.
   - **`app_sessions`**: Phiên đăng nhập cookie bảo mật.
   - **`user_kv`**: Bài làm, thống kê tiến độ và lịch sử làm bài của học viên (`iw:attempt:*`, `iw:stats`).
   - **`app_kv`**: Danh sách đề bài (`prompts`) và ngân hàng ý tưởng (`ideas`).

---

## 4. Chế Độ Fallback Thông Minh

Nếu bạn chưa bật MySQL trong XAMPP:
- Server vẫn chạy bình thường ở chế độ **Local In-Memory Fallback**.
- Không bao giờ bị crash hay gián đoạn trải nghiệm học và chấm bài.
- Ngay khi bạn bấm **Start MySQL** trong XAMPP Control Panel, hệ thống sẽ tự động đồng bộ sang MySQL!

---

## 5. Hướng Dẫn Cấu Hình Đăng Ký / Đăng Nhập Bằng Google

Hệ thống sử dụng thư viện chính thức **Google Identity Services (GIS)**:
1. Mở [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Tạo **OAuth 2.0 Client ID** (chọn loại **Web application**).
3. Tại mục **Authorized JavaScript origins**, thêm: `http://localhost:3000`.
4. Sao chép chuỗi Client ID (có đuôi `.apps.googleusercontent.com`).
5. Thêm vào file `.env`:
   ```env
   GOOGLE_CLIENT_ID=chuoi_client_id_cua_ban.apps.googleusercontent.com
   ```
   *(Hoặc bạn có thể bấm vào nút **Google** trên giao diện web, một hộp thoại hướng dẫn sẽ hiện ra cho phép bạn dán Client ID trực tiếp).*
6. Khi học viên bấm vào nút **Google**, cửa sổ chọn tài khoản Google của học viên sẽ xuất hiện. Sau khi chọn, hệ thống sẽ tự động đăng ký tài khoản với email `@gmail.com` thật và lưu vào bảng `app_users` trong MySQL.
