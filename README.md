# 🌻 Intensive Writer — Nền Tảng Luyện Viết IELTS Task 2 Toàn Diện

Ứng dụng web hỗ trợ luyện viết IELTS Writing Task 2 theo phương pháp **Scaffolding (Kiến tạo tư duy từng bước)**: từ khám phá ý tưởng, xây dựng dàn ý, luyện viết từng đoạn văn cho tới nhận phản hồi và ước lượng band điểm từ AI.

---

## ✨ Điểm Nổi Bật

1. **Khám phá ý tưởng (Ideas Bank & Exploration Drawer)**:
   - 12 đề bài phân bổ theo 5 chủ đề lớn trong IELTS: *Education, Environment, Transportation, Technology, Health*.
   - Mỗi đề có 6 ý tưởng đại diện cho 2 mặt/2 thân bài với từ vựng trọng tâm.
   - Ngăn kéo phân tích chuyên sâu: giải thích bản chất ý tưởng, 2 ví dụ thực tế tại Việt Nam, ngữ cảnh phù hợp và câu văn mẫu Band 7.0+.

2. **Kiến tạo dàn ý (Outline Generator)**:
   - Tạo Thesis Statement định hướng bài viết.
   - Gợi ý Topic Sentences và Bullet points cho Thân bài 1 & Thân bài 2 dựa trên chính các ý tưởng học viên đã lựa chọn.

3. **Luyện viết từng đoạn (Scaffold Writing Flow)**:
   - Viết từng khối: Mở bài (Introduction) → Thân bài 1 → Thân bài 2 → Kết bài (Conclusion).
   - Bộ đếm từ thời gian thực kèm khuyến nghị chuẩn Task 2.
   - Cung cấp cấu trúc câu học thuật (Sentence Templates) gợi ý cho từng khối.
   - Lưu nháp tự động và độc lập cho từng phần.

4. **Phản hồi chi tiết từ AI (Detailed AI Feedback)**:
   - Ước lượng Band điểm theo tiêu chuẩn Grammatical Range & Accuracy + Lexical Resource.
   - Bắt lỗi ngữ pháp (nguyên văn lỗi, gợi ý sửa, giải thích lý do).
   - Đề xuất nâng cấp từ vựng học thuật.
   - Ghi nhận những cụm từ hay/collocation tự nhiên mà học viên đã viết.
   - Lời nhận xét, động viên bằng tiếng Việt.

5. **Gamification & Thống kê (Sunflower Garden Dashboard)**:
   - Khu vườn hoa hướng dương phát triển qua 5 giai đoạn theo số lượng bài viết hoàn thành.
   - Thống kê thời gian luyện tập thực tế và tổng hợp các lỗi ngữ pháp hay gặp.
   - Bộ sưu tập các cụm từ vựng hay được tuyên dương.

6. **Trang Quản Trị Viên Toàn Diện (Admin Portal - `/admin/`)**:
   - Đăng nhập bằng email/mật khẩu được xác thực ở backend; không dùng PIN mặc định trong trình duyệt.
   - **Quản lý Đề bài (Prompts)**: Thêm mới, chỉnh sửa, phân loại theo Theme, xóa đề thi.
   - **Ngân hàng Ý tưởng (Ideas Bank)**: Quản lý luận điểm, luận cứ cho Thân bài 1 & 2 theo từng đề bài.
   - **Theo dõi bài nộp học viên**: Xem chi tiết bài viết của học viên kèm điểm số và phân tích lỗi AI.
   - **Sao lưu & Phục hồi**: Xuất/nhập file sao lưu JSON và khôi phục cài đặt gốc.

7. **Tích hợp AI Linh Hoạt**:
   - **Chế độ Demo / Offline AI**: Có heuristic feedback để dùng thử; không hiển thị band IELTS giả lập từ bộ kiểm tra offline.
   - **Claude qua backend**: API key chỉ được lưu trong Environment Variables của máy chủ. Không nhập API key trong trình duyệt. Xem `DEPLOYMENT_SECURITY.md` để triển khai backend và database.

---

## 🚀 Hướng Dẫn Chạy Ứng Dụng

### Cách 1: Sử dụng Node.js (Khuyên Dùng)
Mở terminal trong thư mục dự án và chạy:
```bash
npm start
```
Hoặc:
```bash
node server.js
```
Truy cập trình duyệt tại: **http://localhost:3000**

### Cách 2: Mở trực tiếp file HTML
Bạn có thể nhấp đúp trực tiếp vào file [web/index.html](file:///c:/Users/mngoc/Downloads/web%20mp/web/index.html) để học viên luyện viết, hoặc [admin/index.html](file:///c:/Users/mngoc/Downloads/web%20mp/admin/index.html) để vào trang quản trị viên.

---

## 📁 Cấu Trúc Thư Mục Được Phân Chia Rõ Ràng
```
web mp/
├── web/                  # Giao diện học viên luyện viết IELTS
│   ├── index.html        # Trang chính của học viên
│   ├── css/
│   │   └── style.css     # Giao diện warm paper, responsive
│   └── js/
│       └── app.js        # Logic luyện viết Scaffold & Dashboard hoa hướng dương
│
├── admin/                # Giao diện quản trị viên
│   ├── index.html        # Trang quản trị (Bảo mật bằng mã PIN)
│   ├── css/
│   │   └── admin.css     # Bảng điều khiển quản trị viên
│   └── js/
│       └── admin.js      # Quản lý đề bài, ý tưởng, bài nộp học viên
│
├── shared/               # Module dùng chung cho cả Web và Admin
│   └── js/
│       ├── storage.js    # Quản lý lưu trữ localStorage & tự động lưu nháp
│       ├── data.js       # DataManager, 12 đề thi gốc và ngân hàng ý tưởng
│       └── ai-service.js # Tích hợp Claude 3.5 Sonnet & Offline AI Engine
│
├── server.js             # Máy chủ Node.js hỗ trợ điều hướng tự động
├── package.json          # Thiết lập npm start / dev
└── README.md             # Tài liệu hướng dẫn sử dụng
```


## Bản sửa bảo mật và đồng bộ

Xem [DEPLOYMENT_SECURITY.md](./DEPLOYMENT_SECURITY.md) để triển khai nhánh `fix/secure-persistence-renderer`, cấu hình API backend, PostgreSQL, đăng nhập Admin và đồng bộ tiến độ học viên. GitHub Pages vẫn chỉ là frontend tĩnh; backend cần được triển khai riêng.
