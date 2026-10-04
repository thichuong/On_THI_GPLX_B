---
name: in-place-updates
description: >-
  Hướng dẫn và quy chuẩn thực hiện cập nhật giao diện tại chỗ (in-place DOM updates) thay vì re-render toàn bộ trang hoặc toàn bộ view trong dự án On_THI_B. Kích hoạt skill này khi người dùng yêu cầu chỉnh sửa, sửa lỗi, phát triển mới hoặc tối ưu hóa các thao tác giao diện liên quan đến chọn đáp án, chuyển câu hỏi, làm lại bài, đánh dấu câu (bookmark), đồng hồ đếm giờ, thanh tiến độ hoặc quản lý cuộn trang (scroll preservation).
---

# Hướng dẫn Kỹ thuật: Cập nhật Giao diện Tại chỗ (In-Place DOM Updates)

Trong ứng dụng ôn thi sát hạch lái xe **On_THI_B**, việc re-render toàn bộ view (`this.render()`) hoặc chuyển hướng trang khi có thay đổi trạng thái cục bộ sẽ gây ra tình trạng chớp nháy (flickering), nhảy vị trí cuộn trang (scroll jumping), mất trạng thái tương tác và giảm hiệu năng trên thiết bị di động.

Skill này hướng dẫn quy trình, các API chuẩn và các mẫu code (patterns) để thực hiện cập nhật in-place chính xác.

---

## 1. Nguyên tắc Cốt lõi & Anti-Patterns

### ❌ Anti-Patterns (Tuyệt đối không làm)
- Không gọi lại `this.render()` khi:
  - Người dùng click chọn đáp án (A, B, C, D / 1, 2, 3, 4).
  - Người dùng bấm nút bookmark ⭐.
  - Người dùng bấm nút "Làm lại câu này".
  - Người dùng bật/tắt checkbox "Xem đáp án ngay".
  - Bộ đếm thời gian nhảy từng giây (timer ticks).
- Không tự ý cuộn lên đầu trang (`window.scrollTo(0, 0)`) giữa lúc người dùng đang làm bài.

###  Quy tắc Chuẩn (Best Practices)
- Chỉ thay đổi các phần tử DOM mục tiêu (cục bộ) bị ảnh hưởng.
- Tận dụng các hàm cập nhật in-place đã được chuẩn hóa trong `src/components/` và `src/utils/dom.js`.
- Khi chuyển câu (Next/Prev/Click số câu): chỉ render lại nội dung thẻ câu hỏi bằng `this.renderQuestionCard()` và highlight nút trên palette bằng `QuestionPalette.updateCurrentIndex()`.

---

## 2. Danh mục API In-Place Sẵn có trong Codebase

### 2.1. Component `QuestionCard` (`src/components/QuestionCard.js`)

| Phương thức | Tham số | Mục đích sử dụng |
| :--- | :--- | :--- |
| `QuestionCard.updateSelection(...)` | `(container, { question, selectedOption, isPractice, isInstantFeedback, isWrongRedo })` | Cập nhật class `selected`, `correct`, `wrong` cho các nút đáp án; chèn box giải thích và nút làm lại trực tiếp vào DOM mà không re-render card. |
| `QuestionCard.resetSelection(...)` | `(container, question)` | Xóa class trạng thái trên các lựa chọn, gỡ bỏ icon tick/cross, ẩn khung giải thích cục bộ khi người dùng muốn làm lại câu. |
| `QuestionCard.updateBookmark(...)` | `(container, isBookmarked)` | Cập nhật class `bookmarked` và icon nút bookmark (⭐) trên thanh công cụ câu hỏi. |

### 2.2. Component `QuestionPalette` (`src/components/QuestionPalette.js`)

| Phương thức | Tham số | Mục đích sử dụng |
| :--- | :--- | :--- |
| `QuestionPalette.updateCurrentIndex(...)` | `(container, newIndex)` | Chuyển class `current` sang nút câu hỏi mới trong bảng câu hỏi mà không vẽ lại toàn bộ lưới nút. |
| `QuestionPalette.updateButtonState(...)` | `(container, index, { isAnswered, isBookmarked, isCorrect, isCriticalFail })` | Cập nhật class trạng thái (`answered`, `bookmarked`, `correct`, `wrong`, `critical-indicator`) cho ô số tương ứng. |
| `QuestionPalette.updateStats(...)` | `(container, { answeredCount, total, isInstantOrPractice, correctCount, wrongCount })` | Cập nhật text thống kê số câu đã làm, số câu đúng/sai trên thanh tiêu đề bảng câu hỏi. |
| `QuestionPalette.preserveScroll(...)` / `restoreScroll(...)` | `(selector)` / `(savedScrollTop, ...)` | Lưu và khôi phục vị trí cuộn của lưới câu hỏi khi có thay đổi cấu trúc danh sách. |

### 2.3. Tiện ích Cuộn Trang `src/utils/dom.js`

| Hàm | Cú pháp | Hành vi |
| :--- | :--- | :--- |
| `preserveScroll` | `preserveScroll(action, selector)` | Thực thi một hàm `action()` đồng thời giữ nguyên tuyệt đối vị trí cuộn của `window` và container chỉ định. |
| `scrollToQuestion` | `scrollToQuestion({ smooth: true, force: false })` | Cuộn thông minh: Chỉ cuộn màn hình nếu thẻ câu hỏi bị che khuất bởi header hoặc quá xa tầm nhìn. Nếu đã nằm trong vùng nhìn thấy thoải mái, hàm sẽ giữ nguyên vị trí, không giật màn hình. |

---

## 3. Mẫu Triển khai Thực tế (Code Patterns)

### Mẫu 1: Xử lý Chọn Đáp án trong View (ví dụ trong `ExamView.js` / `PracticeView.js`)
```javascript
selectOption(optionIndex) {
  const state = store.getState();
  const currentQ = state.examQuestions[state.currentExamIndex];
  const isCorrect = Number(optionIndex) === Number(currentQ.correct_option);

  // 1. Lưu kết quả vào Store / Service
  store.setUserAnswer(currentQ.id, optionIndex);

  // 2. Cập nhật thẻ câu hỏi in-place (không render lại view!)
  QuestionCard.updateSelection(this.container, {
    question: currentQ,
    selectedOption: optionIndex,
    isPractice: true,
    isInstantFeedback: true
  });

  // 3. Cập nhật trạng thái ô trong Palette in-place
  QuestionPalette.updateButtonState(this.container, state.currentExamIndex, {
    isAnswered: true,
    isCorrect,
    isCriticalFail: currentQ.is_critical
  });

  // 4. Cập nhật bộ đếm thống kê
  QuestionPalette.updateStats(this.container, {
    answeredCount: Object.keys(store.getState().userAnswers).length,
    total: state.examQuestions.length
  });
}
```

### Mẫu 2: Xử lý Chuyển Câu Hỏi (Next / Prev / Palette Click)
```javascript
goToQuestion(index) {
  if (index < 0 || index >= this.totalQuestions) return;
  store.setCurrentExamIndex(index);

  // 1. Chỉ render lại phần thẻ câu hỏi
  this.renderQuestionCard();

  // 2. Di chuyển highlight trong palette
  QuestionPalette.updateCurrentIndex(this.container, index);

  // 3. Cuộn nhẹ nhàng tới câu hỏi nếu bị che khuất
  scrollToQuestion({ smooth: true });
}
```

### Mẫu 3: Cập nhật Đồng hồ Đếm Giờ
```javascript
updateTimerDisplay(elapsedSeconds, totalDuration) {
  const timerElem = this.container.querySelector('#exam-timer');
  if (!timerElem) return;

  // Cập nhật trực tiếp nội dung text & class, không render lại bất kỳ element nào khác
  timerElem.textContent = TimerService.formatTime(elapsedSeconds);
  if (totalDuration - elapsedSeconds <= 60) {
    timerElem.classList.add('urgent');
  }
}
```

---

## 4. Danh sách Kiểm tra (Verification Checklist)

Khi chỉnh sửa bất kỳ logic giao diện nào, kiểm tra:
1.  **Không có giật trang (No Flicker)**: Khi bấm chọn đáp án, màn hình có bị chớp trắng hoặc nhảy lại vị trí không?
2.  **Bảo toàn cuộn (Preserved Scroll)**: Vị trí cuộn của người dùng có được giữ nguyên không?
3.  **Bộ đếm/trạng thái đồng bộ (State Synced)**: Nút trên palette có đổi màu đúng trạng thái không? Thống kê số câu đã làm có tăng không?
4.  **Chạy kiểm thử tự động**:
   ```bash
   npm test
   ```
