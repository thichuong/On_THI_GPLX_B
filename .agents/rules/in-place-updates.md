# Quy tắc Cập nhật Giao diện: Sử dụng phương thức In-place thay vì Re-render toàn trang

## 1. Mục tiêu và Nguyên tắc cốt lõi
- **Hướng dẫn kỹ thuật & Runbook chi tiết (Skill)**: [.agents/skills/in-place-updates/SKILL.md](file:///.agents/skills/in-place-updates/SKILL.md)
- **Tuyệt đối tránh re-render toàn bộ trang hoặc toàn bộ view** (`this.render()`, `router.navigate()`, v.v.) khi chỉ có các thay đổi trạng thái cục bộ (local state mutations).
- **Lý do**:
  - Tránh giật lag giao diện (screen flickering, layout shifts).
  - Không làm mất vị trí cuộn trang (scroll jump / reset scroll).
  - Bảo toàn trạng thái focus, con trỏ chuột, bàn phím và animation đang diễn ra.
  - Tối ưu hiệu năng DOM và trải nghiệm người dùng trên cả desktop và mobile.

---

## 2. Quy định cụ thể khi xử lý tương tác UI

### 2.1. Khi người dùng chọn đáp án hoặc làm lại câu hỏi
- **KHÔNG ĐƯỢC**: Gọi lại `render()` của view.
- **BẮT BUỘC**: Sử dụng các hàm cập nhật in-place chuyên dụng:
  - `QuestionCard.updateSelection(container, { question, selectedOption, isPractice, isInstantFeedback, isWrongRedo })`: Cập nhật trực tiếp class CSS của option, icon trạng thái, hiển thị box giải thích và nút làm lại mà không vẽ lại card.
  - `QuestionCard.resetSelection(container, question)`: Xóa lựa chọn đã chọn, ẩn giải thích cục bộ khi người dùng muốn làm lại.
  - Cập nhật palette đồng thời:
    - `QuestionPalette.updateButtonState(container, index, { isAnswered, isCorrect, isCriticalFail })`
    - `QuestionPalette.updateStats(container, { answeredCount, total, ... })`

### 2.2. Khi đánh dấu / bỏ đánh dấu câu hỏi (Bookmark)
- **KHÔNG ĐƯỢC**: Re-render card hay palette.
- **BẮT BUỘC**:
  - `QuestionCard.updateBookmark(container, isBookmarked)`
  - `QuestionPalette.updateButtonState(container, index, { isBookmarked })`

### 2.3. Khi chuyển đổi giữa các câu hỏi (Next / Previous / Chọn từ Palette)
- **KHÔNG ĐƯỢC**: Re-render toàn bộ view (sidebar, header, danh sách câu, layout wrapper).
- **BẮT BUỘC**:
  - Chỉ re-render cục bộ component câu hỏi: gọi `this.renderQuestionCard()` để thay thế nội dung trong `#question-card-wrapper`.
  - Cập nhật vị trí con trỏ trong bảng câu hỏi: `QuestionPalette.updateCurrentIndex(this.container, newIndex)`.
  - Cuộn trang thông minh: Sử dụng `scrollToQuestion({ smooth: true })` (chỉ cuộn khi câu hỏi bị che khuất bởi header hoặc ngoài viewport).

### 2.4. Khi cập nhật bộ đếm thời gian hoặc tiến trình
- Cập nhật trực tiếp thuộc tính phần tử:
  ```js
  timerElem.textContent = formattedTime;
  timerElem.className = `timer-display ${statusClass}`;
  ```
- Không đụng chạm đến các phần tử DOM khác ngoài bộ đếm.

---

## 3. Quản lý vị trí cuộn (Scroll Preservation)
- Khi bắt buộc phải can thiệp hoặc thay thế một phần tử con có nguy cơ gây nhảy cuộn:
  - Sử dụng helper `preserveScroll(action, selector)` từ `src/utils/dom.js`.
  - Đối với bảng câu hỏi dạng lưới cuộn: sử dụng `QuestionPalette.preserveScroll(selector)` và `QuestionPalette.restoreScroll(savedScrollTop)`.
- Không tự ý cuộn lên đầu trang khi người dùng đang thao tác làm bài.

---

## 4. Phát triển tính năng mới
- Khi tạo mới hoặc tái cấu trúc component/view:
  - Thiết kế API hỗ trợ cập nhật cục bộ (ví dụ: `update(...)`, `updateStatus(...)`, `patch(...)`).
  - Tách biệt rõ ràng giữa **Full Initial Render** (chỉ chạy 1 lần khi khởi tạo/đổi view) và **Partial In-place Updates** (chạy khi có sự kiện/tương tác).
