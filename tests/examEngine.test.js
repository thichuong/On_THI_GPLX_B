import test from 'node:test';
import assert from 'node:assert/strict';
import { ExamEngine, EXAM_PRESETS } from '../src/services/examEngine.js';
import questionsData from '../src/data/questions.json' with { type: 'json' };

test('ExamEngine - Standard Exam Generation (30 questions)', () => {
  const questions = ExamEngine.generateExam(questionsData, 'standard');
  assert.equal(questions.length, 30, 'Standard exam must generate exactly 30 questions');
  
  const criticalCount = questions.filter(q => q.is_critical).length;
  assert.ok(criticalCount >= 1 && criticalCount <= 2, 'Critical questions must be between 1 and 2');

  const ids = new Set(questions.map(q => q.id));
  assert.equal(ids.size, 30, 'All 30 questions in an exam must be unique');

  const chCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  questions.forEach(q => chCounts[q.chapter]++);
  assert.deepEqual(chCounts, { 1: 9, 2: 1, 3: 3, 4: 2, 5: 9, 6: 6 }, 'Standard exam must follow 30/600 chapter quota {1:9, 2:1, 3:3, 4:2, 5:9, 6:6}');
});

test('ExamEngine - Quick Exam Generation (20 questions)', () => {
  const questions = ExamEngine.generateExam(questionsData, 'quick');
  assert.equal(questions.length, 20, 'Quick exam must generate exactly 20 questions');

  const criticalCount = questions.filter(q => q.is_critical).length;
  assert.ok(criticalCount >= 1, 'Quick exam must contain at least 1 critical question');

  const ids = new Set(questions.map(q => q.id));
  assert.equal(ids.size, 20, 'All 20 questions must be unique');

  const chCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  questions.forEach(q => chCounts[q.chapter]++);
  assert.deepEqual(chCounts, { 1: 6, 2: 1, 3: 2, 4: 1, 5: 6, 6: 4 }, 'Quick exam must follow 20/600 chapter quota {1:6, 2:1, 3:2, 4:1, 5:6, 6:4}');
});

test('ExamEngine - Unseen Questions Cycle for Standard Exam (Auto-Reset on Exhaustion)', () => {
  let seenStandard = new Set();
  let resetsCount = 0;

  // Run 21 consecutive exams (20 * 30 = 600 questions)
  for (let examIndex = 1; examIndex <= 21; examIndex++) {
    const result = ExamEngine.generateExam(questionsData, 'standard', {
      seenQuestionIds: seenStandard,
      onCycleReset: () => {
        resetsCount++;
        seenStandard.clear();
      }
    });

    assert.equal(result.length, 30, `Exam ${examIndex} must have 30 questions`);

    if (examIndex <= 20) {
      assert.equal(result.isCycleReset, false, `Exam ${examIndex} should not reset cycle yet`);
      // Verify no questions were already in seen set
      for (const q of result) {
        assert.ok(!seenStandard.has(q.id), `Exam ${examIndex} question #${q.id} was already seen!`);
      }
      result.newlySelectedIds.forEach(id => seenStandard.add(id));
    } else {
      // Exam 21: 600 questions were exhausted -> cycle must reset
      assert.equal(result.isCycleReset, true, 'Exam 21 must trigger cycle reset');
      assert.ok(resetsCount >= 1, 'onCycleReset callback must be invoked');
    }
  }
});

test('ExamEngine - Unseen Questions Cycle for Quick Exam (Auto-Reset on Exhaustion)', () => {
  let seenQuick = new Set();
  let resetsCount = 0;

  // Run 31 consecutive quick exams (30 * 20 = 600 questions)
  for (let examIndex = 1; examIndex <= 31; examIndex++) {
    const result = ExamEngine.generateExam(questionsData, 'quick', {
      seenQuestionIds: seenQuick,
      onCycleReset: () => {
        resetsCount++;
        seenQuick.clear();
      }
    });

    assert.equal(result.length, 20, `Quick exam ${examIndex} must have 20 questions`);

    if (examIndex <= 30) {
      assert.equal(result.isCycleReset, false, `Quick exam ${examIndex} should not reset yet`);
      for (const q of result) {
        assert.ok(!seenQuick.has(q.id), `Quick exam ${examIndex} question #${q.id} was already seen!`);
      }
      result.newlySelectedIds.forEach(id => seenQuick.add(id));
    } else {
      // Exam 31: 600 questions exhausted -> must reset
      assert.equal(result.isCycleReset, true, 'Quick exam 31 must trigger cycle reset');
      assert.ok(resetsCount >= 1, 'onCycleReset callback must be invoked');
    }
  }
});

test('ExamEngine - Wrong Redo Mode: 0 wrong questions', () => {
  const result = ExamEngine.generateExam(questionsData, 'quick', {
    mode: 'wrong_redo',
    wrongQuestionIds: []
  });
  assert.equal(result.length, 0, 'Should return 0 questions when wrong list is empty');
  assert.equal(result.isWrongRedo, true, 'isWrongRedo flag must be true');
});

test('ExamEngine - Wrong Redo Mode: < 20 wrong questions (e.g. 7 questions)', () => {
  const sampleWrong = [10, 25, 42, 88, 115, 204, 305];
  const result = ExamEngine.generateExam(questionsData, 'quick', {
    mode: 'wrong_redo',
    wrongQuestionIds: sampleWrong
  });

  assert.equal(result.length, 7, 'Should return exactly 7 questions');
  const returnedIds = result.map(q => q.id).sort((a, b) => a - b);
  assert.deepEqual(returnedIds, sampleWrong, 'Returned questions must match wrong list exactly');
  assert.equal(result.isWrongRedo, true);
});

test('ExamEngine - Wrong Redo Mode: > 20 wrong questions (e.g. 35 questions)', () => {
  const sample35 = Array.from({ length: 35 }, (_, i) => i + 1);
  const result = ExamEngine.generateExam(questionsData, 'quick', {
    mode: 'wrong_redo',
    wrongQuestionIds: sample35
  });

  assert.equal(result.length, 20, 'Should cap at maximum 20 questions');
  for (const q of result) {
    assert.ok(sample35.includes(q.id), `Question #${q.id} must be in the wrong pool`);
  }
  assert.equal(result.isWrongRedo, true);
});

test('ExamEngine - Grading logic (gradeExam)', () => {
  const sampleQuestions = questionsData.slice(0, 5);
  // Answers: 3 correct, 1 wrong, 1 unattempted
  const userAnswers = {
    [sampleQuestions[0].id]: sampleQuestions[0].correct_option,
    [sampleQuestions[1].id]: sampleQuestions[1].correct_option,
    [sampleQuestions[2].id]: sampleQuestions[2].correct_option,
    [sampleQuestions[3].id]: sampleQuestions[3].correct_option === 1 ? 2 : 1
    // [sampleQuestions[4].id] not answered
  };

  const graded = ExamEngine.gradeExam(sampleQuestions, userAnswers, 4);
  assert.equal(graded.total, 5);
  assert.equal(graded.score, 3);
  assert.equal(graded.wrongCount, 1);
  assert.equal(graded.unattemptedCount, 1);
  assert.equal(graded.passed, false, 'Score 3/5 < threshold 4 must be failed');
  assert.ok(graded.wrongQuestionIds.includes(sampleQuestions[3].id));
  assert.ok(graded.wrongQuestionIds.includes(sampleQuestions[4].id));
});

