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

6. **Tích hợp AI Linh Hoạt**:
   - **Chế độ Demo / Offline AI**: Hoạt động hoàn toàn tự động ngay cả khi không có kết nối API, tạo trải nghiệm mượt mà không lỗi.
   - **Tùy chọn Claude 3.5 Sonnet**: Có thể nhập API Key của Anthropic trực tiếp trong phần Cài đặt (⚙️) bất cứ lúc nào.

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
Bạn có thể nhấp đúp trực tiếp vào file `index.html` trong File Explorer để mở bằng Chrome, Edge hoặc bất kỳ trình duyệt hiện đại nào.

---

## 📁 Cấu Trúc Thư Mục
```
web mp/
├── index.html        # Trang HTML chính với giao diện và modal hoàn chỉnh
├── server.js         # Máy chủ HTTP cục bộ nhẹ nhàng (Node.js thuần)
├── package.json      # Thiết lập khởi chạy lệnh npm start/dev
├── README.md         # Tài liệu hướng dẫn sử dụng
├── css/
│   └── style.css     # Thiết kế hệ thống màu warm paper, hiệu ứng mượt mà
└── js/
    ├── storage.js    # Quản lý bộ nhớ localStorage và polyfill window.storage
    ├── data.js       # Dữ liệu 12 đề bài, ngân hàng ý tưởng và cấu trúc câu
    ├── ai-service.js # Tích hợp Claude API và bộ máy phản hồi offline
    └── app.js        # Logic điều khiển, render giao diện, đồng hồ và dashboard
```
