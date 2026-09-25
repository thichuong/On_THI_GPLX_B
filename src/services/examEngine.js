/**
 * Exam Engine: Generates balanced mock exams with guaranteed critical questions,
 * handles presets (50 questions in 33 mins / 20 questions in 10 mins), shuffling,
 * timer state, and official grading logic.
 */

export const EXAM_PRESETS = {
  standard: {
    key: 'standard',
    name: 'Thi Thử Chuẩn (30 Câu / 20 Phút)',
    shortName: 'Thi Thử Chuẩn (30 Câu)',
    totalQuestions: 30,
    durationMinutes: 20,
    durationSeconds: 20 * 60,
    passThreshold: 27,
    minCritical: 1,
    maxCritical: 2,
    chapterQuotas: {
      1: 9,  // Quy định chung & quy tắc (180 * 30/600 = 9)
      2: 1,  // Văn hóa & đạo đức (25 * 30/600 = 1.25 -> 1)
      3: 3,  // Kỹ thuật lái xe (58 * 30/600 = 2.9 -> 3)
      4: 2,  // Cấu tạo & sửa chữa (37 * 30/600 = 1.85 -> 2)
      5: 9,  // Biển báo (185 * 30/600 = 9.25 -> 9)
      6: 6   // Sa hình (115 * 30/600 = 5.75 -> 6)
    }
  },
  quick: {
    key: 'quick',
    name: 'Thi Nhanh (20 Câu / 10 Phút)',
    shortName: 'Thi Nhanh (20 Câu)',
    totalQuestions: 20,
    durationMinutes: 10,
    durationSeconds: 10 * 60,
    passThreshold: 18,
    minCritical: 1,
    maxCritical: 1,
    chapterQuotas: {
      1: 6,  // Quy định chung & quy tắc (180 * 20/600 = 6)
      2: 1,  // Văn hóa & đạo đức (25 * 20/600 = 0.83 -> 1)
      3: 2,  // Kỹ thuật lái xe (58 * 20/600 = 1.93 -> 2)
      4: 1,  // Cấu tạo & sửa chữa (37 * 20/600 = 1.23 -> 1)
      5: 6,  // Biển báo (185 * 20/600 = 6.17 -> 6)
      6: 4   // Sa hình (115 * 20/600 = 3.83 -> 4)
    }
  }
};

export class ExamEngine {
  /**
   * Generates a balanced mock test according to the specified preset.
   *
   * @param {Array} allQuestions Full list of 600 questions
   * @param {string} examType 'standard' (50 questions) | 'quick' (20 questions)
   * @param {Object} options Configuration options
   * @returns {Array} Array of questions prepared for the exam
   */
  static generateExam(allQuestions, examType = 'standard', options = {}) {
    // 0. Special Mode: Làm lại câu sai (wrong_redo)
    if (options.mode === 'wrong_redo') {
      const wrongIds = new Set((options.wrongQuestionIds || []).map(Number));
      let wrongPool = allQuestions.filter(q => wrongIds.has(q.id));
      if (options.shuffleQuestions !== false) {
        wrongPool = this.shuffleArray(wrongPool);
      }
      const limit = Math.min(wrongPool.length, options.totalQuestions || 20);
      const selected = wrongPool.slice(0, limit);
      const result = selected.map((q, index) => ({
        ...q,
        examIndex: index + 1
      }));
      result.isWrongRedo = true;
      result.isCycleReset = false;
      result.newlySelectedIds = result.map(q => q.id);
      return result;
    }

    const preset = EXAM_PRESETS[examType] || EXAM_PRESETS.standard;
    const {
      totalQuestions = preset.totalQuestions,
      minCritical = preset.minCritical,
      maxCritical = preset.maxCritical,
      chapterQuotas = preset.chapterQuotas,
      shuffleQuestions = true,
      shuffleOptions = false,
      seenQuestionIds = null
    } = options;

    // 1. Check unseen pool and cycle reset condition
    let workingPool = allQuestions;
    let isCycleReset = false;

    if (seenQuestionIds && seenQuestionIds.size > 0) {
      const unseenPool = allQuestions.filter(q => !seenQuestionIds.has(q.id));
      const unseenCriticalCount = unseenPool.filter(q => q.is_critical).length;

      // Only pick from unseen if there are enough questions and critical questions
      if (unseenPool.length >= totalQuestions && unseenCriticalCount >= minCritical) {
        workingPool = unseenPool;
      } else {
        // Not enough questions in the cycle -> auto reset cycle!
        isCycleReset = true;
        workingPool = allQuestions;
        if (typeof options.onCycleReset === 'function') {
          options.onCycleReset();
        }
      }
    }

    // Filter into categories from working pool
    const criticalQuestions = workingPool.filter(q => q.is_critical);
    const nonCriticalQuestions = workingPool.filter(q => !q.is_critical);

    // Group non-critical by chapter
    const byChapter = {
      1: nonCriticalQuestions.filter(q => q.chapter === 1),
      2: nonCriticalQuestions.filter(q => q.chapter === 2),
      3: nonCriticalQuestions.filter(q => q.chapter === 3),
      4: nonCriticalQuestions.filter(q => q.chapter === 4),
      5: nonCriticalQuestions.filter(q => q.chapter === 5),
      6: nonCriticalQuestions.filter(q => q.chapter === 6)
    };

    // 2. Pick critical questions randomly (at least minCritical)
    const criticalCount = Math.min(
      criticalQuestions.length,
      Math.floor(Math.random() * (maxCritical - minCritical + 1)) + minCritical
    );
    const shuffledCritical = this.shuffleArray([...criticalQuestions]);
    const selectedCritical = shuffledCritical.slice(0, criticalCount);
    const selectedIds = new Set(selectedCritical.map(q => q.id));

    // 3. Distribute remaining questions across chapters
    const adjustedQuotas = { ...chapterQuotas };
    // Adjust chapter quota if critical question belonged there
    selectedCritical.forEach(cq => {
      if (adjustedQuotas[cq.chapter] !== undefined) {
        adjustedQuotas[cq.chapter] = Math.max(0, adjustedQuotas[cq.chapter] - 1);
      }
    });

    let selectedOthers = [];
    for (const [ch, quota] of Object.entries(adjustedQuotas)) {
      const pool = byChapter[ch] || [];
      const available = pool.filter(q => !selectedIds.has(q.id));
      const shuffledPool = this.shuffleArray([...available]);
      const needed = Math.max(0, quota);
      const chosen = shuffledPool.slice(0, Math.min(needed, available.length));
      chosen.forEach(q => {
        selectedOthers.push(q);
        selectedIds.add(q.id);
      });
    }

    // Fill any gap from remaining non-critical pool first, fallback to working pool
    let totalNeeded = totalQuestions - (selectedCritical.length + selectedOthers.length);
    if (totalNeeded > 0) {
      const remainingNonCritical = nonCriticalQuestions.filter(q => !selectedIds.has(q.id));
      const sourcePool = remainingNonCritical.length >= totalNeeded
        ? remainingNonCritical
        : workingPool.filter(q => !selectedIds.has(q.id));
      const extra = this.shuffleArray([...sourcePool]).slice(0, totalNeeded);
      extra.forEach(q => {
        selectedOthers.push(q);
        selectedIds.add(q.id);
      });
    }

    let examSet = [...selectedCritical, ...selectedOthers];

    // Guarantee exact total count
    if (examSet.length > totalQuestions) {
      examSet = examSet.slice(0, totalQuestions);
    }

    // Shuffle the order of questions in the exam if enabled
    if (shuffleQuestions) {
      examSet = this.shuffleArray(examSet);
    }

    // Prepare questions (with clone so original is untouched)
    const finalResult = examSet.map((q, index) => {
      const examQ = {
        ...q,
        examIndex: index + 1
      };

      if (shuffleOptions) {
        // Shuffle options and update correct_option index
        const indexedOptions = q.options.map((opt, i) => ({ text: opt, isCorrect: i + 1 === q.correct_option }));
        const shuffled = this.shuffleArray(indexedOptions);
        examQ.options = shuffled.map(o => o.text);
        examQ.correct_option = shuffled.findIndex(o => o.isCorrect) + 1;
      }

      return examQ;
    });

    finalResult.isWrongRedo = false;
    finalResult.isCycleReset = isCycleReset;
    finalResult.newlySelectedIds = finalResult.map(q => q.id);

    return finalResult;
  }

  /**
   * Generates a 30-question mock test (20 minutes standard).
   */
  static generate30QuestionExam(allQuestions, options = {}) {
    return this.generateExam(allQuestions, 'standard', options);
  }

  /**
   * Generates a 20-question quick test (10 minutes quick mode).
   */
  static generate20QuestionExam(allQuestions, options = {}) {
    return this.generateExam(allQuestions, 'quick', options);
  }

  /**
   * Backward compatibility alias
   */
  static generate50QuestionExam(allQuestions, options = {}) {
    return this.generateExam(allQuestions, 'standard', options);
  }

  /**
   * Grades the exam and determines PASS / FAIL with critical failure check.
   *
   * @param {Array} examQuestions Questions in the test
   * @param {Object} userAnswers Map of { [questionId]: selectedOptionIndex }
   * @param {number|null} passThreshold Minimum score to pass (defaults based on question count)
   * @returns {Object} Grading summary
   */
  static gradeExam(examQuestions, userAnswers, passThreshold = null) {
    const total = examQuestions.length;
    // Default pass thresholds: 27/30 for 30-question, 45/50 for 50-question, 18/20 for 20-question, or 90%
    const resolvedThreshold = passThreshold !== null
      ? passThreshold
      : (total === 30 ? 27 : (total === 50 ? 45 : (total === 20 ? 18 : Math.ceil(total * 0.9))));

    let correctCount = 0;
    let wrongCount = 0;
    let unattemptedCount = 0;
    let failedCritical = false;
    let failedCriticalQuestions = [];
    const wrongQuestionIds = [];
    const questionResults = [];

    examQuestions.forEach((q, index) => {
      const userAnswer = userAnswers[q.id];
      const isAnswered = userAnswer !== undefined && userAnswer !== null;
      const isCorrect = isAnswered && Number(userAnswer) === Number(q.correct_option);

      if (!isAnswered) {
        unattemptedCount++;
        wrongQuestionIds.push(q.id);
      } else if (isCorrect) {
        correctCount++;
      } else {
        wrongCount++;
        wrongQuestionIds.push(q.id);
      }

      if (!isCorrect && q.is_critical) {
        failedCritical = true;
        failedCriticalQuestions.push({
          id: q.id,
          question: q.question,
          userAnswer: isAnswered ? userAnswer : 'Chưa trả lời',
          correctAnswer: q.correct_option,
          correctText: q.options[q.correct_option - 1]
        });
      }

      questionResults.push({
        id: q.id,
        examIndex: index + 1,
        question: q.question,
        image: q.image,
        options: q.options,
        userAnswer: isAnswered ? Number(userAnswer) : null,
        correctAnswer: Number(q.correct_option),
        isCorrect,
        isCritical: q.is_critical,
        explanation: q.explanation || (q.is_critical ? 'Câu điểm liệt - bắt buộc trả lời đúng!' : '')
      });
    });

    const passed = (correctCount >= resolvedThreshold) && !failedCritical;

    return {
      total,
      score: correctCount,
      wrongCount,
      unattemptedCount,
      passThreshold: resolvedThreshold,
      passed,
      failedCritical,
      failedCriticalQuestions,
      wrongQuestionIds,
      questionResults,
      percentage: Math.round((correctCount / total) * 100)
    };
  }

  /**
   * Helper: Durstenfeld shuffle algorithm
   */
  static shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

