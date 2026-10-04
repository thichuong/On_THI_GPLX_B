---
name: in-place-updates
description: >-
  Hướng dẫn và quy chuẩn tối ưu hóa giao diện phản ứng tại chỗ (In-Place Reactivity & Smooth UI Updates)
  thay vì re-mount toàn bộ view hoặc gây giật lag (flicker/scroll jumps) trong dự án On_THI_B viết bằng Vue 3.
  Kích hoạt skill này khi can thiệp vào các thao tác chọn đáp án, chuyển câu, làm lại bài, đánh dấu câu (bookmark),
  đồng hồ đếm giờ, thanh tiến độ hoặc quản lý cuộn trang (scroll preservation).
---

# Hướng dẫn Kỹ thuật: Phản ứng Giao diện Tại chỗ trong Vue 3 (In-Place Reactive Updates)

Trong ứng dụng **On_THI_B** (Vue 3 Composition API), hệ thống Reactivity và Virtual DOM tự động thực hiện patch DOM tối ưu. Tuy nhiên, nếu cấu trúc component, quản lý `:key`, hoặc thay đổi trạng thái không chuẩn xác, ứng dụng vẫn có thể gặp phải:
- Chớp nháy giao diện (flickering do re-mount không cần thiết).
- Nhảy vị trí cuộn trang (scroll jump làm mất ngữ cảnh người dùng đang đọc).
- Re-render thừa thãi các thành phần không liên quan (ví dụ: bộ đếm giây làm render lại toàn bộ câu hỏi).

Skill này chuẩn hóa các nguyên tắc, mô hình component và pattern phản ứng tại chỗ trong Vue 3.

---

## 1. Nguyên tắc Cốt lõi & Anti-Patterns trong Vue 3

### ❌ Anti-Patterns (Tuyệt đối không làm)
1. **Lạm dụng `:key` gây re-mount toàn bộ component/view**:
   - Không gán `:key` thay đổi theo trạng thái chọn đáp án hoặc bookmark trên thẻ cha (ví dụ: `:key="question.id + '-' + selectedAnswer"` sẽ hủy và tạo lại DOM element, làm mất animation và nhảy cuộn).
   - Chỉ đổi `:key` khi thực sự chuyển hẳn sang câu hỏi khác (`:key="currentQuestion.id"`).
2. **Re-mount View bằng Router khi chỉ đổi trạng thái nội bộ**:
   - Không gọi `router.push(...)` hay thay đổi route khi người dùng chỉ đang chọn đáp án, bấm bookmark, bấm "Làm lại câu", hay bật/tắt "Xem đáp án ngay".
3. **Trộn lẫn State của Timer vào Card câu hỏi**:
   - Không để reactive state của timer (nhảy từng giây) trigger re-render component câu hỏi hoặc bảng câu hỏi (QuestionPalette).
4. **Tự ý cuộn trang đột ngột**:
   - Tuyệt đối không gọi `window.scrollTo(0, 0)` khi người dùng đang bấm chọn đáp án hoặc thao tác trong câu hỏi hiện tại.

###  Quy tắc Chuẩn (Best Practices)
1. **Fine-grained Reactivity (Phản ứng hạt mịn)**:
   - Thay đổi state cục bộ (`answers[questionId] = optionIndex`, `isBookmarked.value = !isBookmarked.value`). Vue sẽ tự động chỉ patch đúng class CSS của button và ô tương ứng trên palette.
2. **Component Isolation (Tách biệt component theo chu kỳ cập nhật)**:
   - Tách `ExamTimer.vue` thành component độc lập: bộ đếm 1s chỉ patch text trong timer mà không ảnh hưởng gì tới các component khác.
   - `QuestionCard.vue` nhận props và emit sự kiện (`@select-option`, `@toggle-bookmark`, `@redo`).
   - `QuestionPalette.vue` nhận danh sách câu và map câu trả lời để hiển thị trạng thái từng ô.
3. **Cuộn trang thông minh (Smart Scroll)**:
   - Sử dụng `scrollToQuestion({ smooth: true })` chỉ khi người dùng chuyển hẳn sang câu hỏi khác (Next / Prev / bấm ô trên Palette) nếu câu hỏi mới nằm ngoài tầm nhìn.
   - Giữ nguyên vị trí cuộn của khung danh sách câu hỏi khi chọn đáp án.

---

## 2. Kiến trúc & Phân tách Component

### 2.1. `QuestionCard.vue`
- Nhận props: `question`, `selectedOption`, `isSubmitted`, `isReviewMode`, `isPractice`, `isBookmarked`, `showExplanation`.
- Sử dụng dynamic classes:
  ```vue
  <button
    class="option-item"
    :class="{
      selected: selectedOption === index,
      correct: showResult && isCorrectOption(index),
      wrong: showResult && selectedOption === index && !isCorrectOption(index)
    }"
    @click="handleSelect(index)"
  >
  ```
- Hiển thị box giải thích mượt mà bằng `<transition>` hoặc `v-if="showExplanation"`.

### 2.2. `QuestionPalette.vue`
- Hiển thị lưới số câu hỏi (1 -> 30 hoặc 1 -> 600).
- Mỗi nút câu hỏi phản ứng trực tiếp theo computed trạng thái (`isCurrent`, `isAnswered`, `isCorrect`, `isCritical`).
- Không render lại toàn bộ danh sách khi chuyển câu, chỉ nút active và nút có đáp án thay đổi class.

### 2.3. `ExamTimer.vue`
- Quản lý lifecycle đếm giờ độc lập bằng `useTimer()`.
- Chỉ cập nhật hiển thị số phút:giây và class cảnh báo thời gian sắp hết (`urgent`).

---

## 3. Mẫu Triển khai Thực tế (Code Patterns)

### Mẫu 1: Xử lý Chọn Đáp án trong View (`ExamView.vue` / `PracticeView.vue`)
```vue
<script setup>
import { computed } from 'vue';
import { useExamStore } from '../composables/useExamStore';
import QuestionCard from '../components/QuestionCard.vue';
import QuestionPalette from '../components/QuestionPalette.vue';

const {
  currentQuestion,
  currentIndex,
  userAnswers,
  selectAnswer,
  isInstantFeedback
} = useExamStore();

function onSelectOption(optionIndex) {
  // 1. Cập nhật reactive state (Vue tự động patch DOM tại chỗ)
  selectAnswer(currentQuestion.value.id, optionIndex);
  
  // 2. KHÔNG can thiệp vị trí cuộn màn hình khi đang chọn đáp án
}
</script>

<template>
  <div class="exam-container">
    <QuestionCard
      :key="currentQuestion.id"
      :question="currentQuestion"
      :selected-option="userAnswers[currentQuestion.id]"
      :instant-feedback="isInstantFeedback"
      @select="onSelectOption"
    />
    <QuestionPalette
      :current-index="currentIndex"
      :answers="userAnswers"
    />
  </div>
</template>
```

### Mẫu 2: Chuyển câu hỏi & Cuộn thông minh
```javascript
import { nextTick } from 'vue';
import { scrollToQuestion } from '../utils/dom';

async function goToQuestion(targetIndex) {
  if (targetIndex < 0 || targetIndex >= totalQuestions.value) return;
  
  currentIndex.value = targetIndex;
  
  // Đợi DOM hoàn tất render câu mới rồi cuộn nhẹ nếu bị che
  await nextTick();
  scrollToQuestion({ smooth: true });
}
```

---

## 4. Danh sách Kiểm tra (Verification Checklist)

Khi thay đổi hoặc tạo mới tính năng trong Vue:
1.  **Tránh Re-mount thừa**: Kiểm tra Vue Devtools hoặc transition: component cha có bị unmount khi thao tác chọn đáp án không?
2.  **Bảo toàn vị trí cuộn**: Bấm chọn đáp án hoặc bookmark không được làm màn hình giật lên đầu trang.
3.  **Bộ đếm thời gian tách biệt**: Timer chạy mỗi giây không làm trigger re-render trên `QuestionCard`.
4.  **Kiểm thử tự động**:
   ```bash
   npm test
   ```

