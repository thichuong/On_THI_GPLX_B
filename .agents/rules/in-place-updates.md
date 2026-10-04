# Quy tắc Phản ứng Giao diện: Tận dụng Vue 3 Reactivity thay vì Re-mount toàn bộ View

## 1. Mục tiêu và Nguyên tắc cốt lõi
- **Hướng dẫn kỹ thuật & Runbook chi tiết (Skill)**: [.agents/skills/in-place-updates/SKILL.md](file:///.agents/skills/in-place-updates/SKILL.md)
- **Tuyệt đối tránh re-mount toàn bộ trang hoặc toàn bộ view** (`router.push()`, reset state root, hoặc lạm dụng dynamic `:key` trên container cha) khi chỉ có các thay đổi trạng thái cục bộ (local state mutations).
- **Lý do**:
  - Tránh giật lag giao diện (screen flickering, layout shifts).
  - Không làm mất vị trí cuộn trang (scroll jump / reset scroll).
  - Bảo toàn trạng thái focus, con trỏ chuột, bàn phím và animation đang diễn ra.
  - Tối ưu hiệu năng DOM và Virtual DOM patching trên cả desktop và mobile.

---

## 2. Quy định cụ thể khi xử lý tương tác UI trong Vue 3

### 2.1. Khi người dùng chọn đáp án hoặc làm lại câu hỏi
- **KHÔNG ĐƯỢC**: Thay đổi route hoặc re-mount view cha.
- **BẮT BUỘC**:
  - Cập nhật trực tiếp vào reactive state (ví dụ `userAnswers[currentQuestion.id] = optionIndex`).
  - Vue Virtual DOM sẽ tự động patch các class CSS `:class="{ selected, correct, wrong }"` và hiển thị explanation box cục bộ.
  - Palette tự động phản ứng dựa trên state của danh sách câu hỏi mà không làm mất trạng thái cuộn của palette.

### 2.2. Khi đánh dấu / bỏ đánh dấu câu hỏi (Bookmark)
- **KHÔNG ĐƯỢC**: Re-mount card hay palette.
- **BẮT BUỘC**:
  - Thay đổi cờ trạng thái bookmark trong reactive store (`toggleBookmark(id)`).
  - Tự động phản ứng icon ⭐ trên `QuestionCard` và badge đánh dấu trên `QuestionPalette`.

### 2.3. Khi chuyển đổi giữa các câu hỏi (Next / Previous / Chọn từ Palette)
- **KHÔNG ĐƯỢC**: Re-mount toàn bộ view (sidebar, header, danh sách câu, layout wrapper).
- **BẮT BUỘC**:
  - Chỉ thay đổi chỉ số câu hỏi hiện tại `currentIndex.value = newIndex`.
  - Chỉ component `QuestionCard` phản ứng với câu hỏi mới (hoặc re-mount nhẹ nhàng qua `:key="currentQuestion.id"`).
  - Cuộn thông minh: Sử dụng `scrollToQuestion({ smooth: true })` (chỉ cuộn khi câu hỏi mới bị che khuất bởi header hoặc ngoài viewport).

### 2.4. Khi cập nhật bộ đếm thời gian hoặc tiến trình
- Tách `ExamTimer.vue` thành component độc lập.
- Timer tick mỗi giây CHỈ cập nhật nội dung bên trong `ExamTimer.vue`, không kích hoạt reactivity trên component câu hỏi hay bảng câu hỏi.

---

## 3. Quản lý vị trí cuộn (Scroll Preservation)
- Tuyệt đối không tự ý cuộn lên đầu trang (`window.scrollTo(0, 0)`) khi người dùng đang bấm chọn đáp án, bấm bookmark hay tương tác trong bài.
- Giữ nguyên vị trí cuộn của lưới câu hỏi trong `QuestionPalette` khi chọn đáp án.

---

## 4. Phát triển tính năng mới
- Sử dụng Vue 3 `<script setup>` (Composition API).
- Giữ vững tính phân tách: Component cha nắm giữ luồng điều hướng, Component con thuần túy nhận Props và phát ra Events (`defineProps`, `defineEmits`).
- Tách biệt logic nghiệp vụ phức tạp vào các Composables (`useExam`, `usePractice`, `useStorage`, `useTimer`).

