/**
 * Storage Service: Manages persistence for theme, bookmarks, wrong answers,
 * exam history, and exam cycles with IndexedDB backing and localStorage fallback.
 */
import { eventBus } from '../core/eventBus.js';
import { dbService } from './dbService.js';
import { questionService } from './questionService.js';

const STORAGE_KEYS = {
  THEME: 'gplx_theme',
  BOOKMARKS: 'gplx_bookmarks',
  WRONG_QUESTIONS: 'gplx_wrong_questions',
  EXAM_HISTORY: 'gplx_exam_history',
  SETTINGS: 'gplx_settings',
  SEEN_STANDARD: 'gplx_seen_standard',
  SEEN_QUICK: 'gplx_seen_quick',
  CHAPTER_PROGRESS: 'gplx_chapter_progress',
  CRITICAL_PROGRESS: 'gplx_critical_progress'
};

class StorageServiceImpl {
  constructor() {
    this._initialized = false;
    this._initPromise = null;
    this._cache = {
      theme: null,
      bookmarks: null,
      wrongQuestions: null,
      seenStandard: null,
      seenQuick: null,
      chapterProgress: null,
      criticalProgress: null
    };
  }

  /**
   * Initializes IndexedDB and hydrates cache
   */
  async init() {
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      try {
        await dbService.init();

        // Hydrate seen cycles from IndexedDB if available
        const [stdCycle, qkCycle, idbChapterProg, idbCriticalProg] = await Promise.all([
          dbService.getExamCycle('standard'),
          dbService.getExamCycle('quick'),
          dbService.getMeta('chapter_progress'),
          dbService.getMeta('critical_progress')
        ]);

        if (Array.isArray(stdCycle) && stdCycle.length > 0) {
          this._cache.seenStandard = new Set(stdCycle);
          localStorage.setItem(STORAGE_KEYS.SEEN_STANDARD, JSON.stringify(stdCycle));
        }

        if (Array.isArray(qkCycle) && qkCycle.length > 0) {
          this._cache.seenQuick = new Set(qkCycle);
          localStorage.setItem(STORAGE_KEYS.SEEN_QUICK, JSON.stringify(qkCycle));
        }

        // Hydrate chapter progress from IndexedDB if localStorage does not have it
        if (idbChapterProg && !localStorage.getItem(STORAGE_KEYS.CHAPTER_PROGRESS)) {
          this._cache.chapterProgress = idbChapterProg;
          localStorage.setItem(STORAGE_KEYS.CHAPTER_PROGRESS, JSON.stringify(idbChapterProg));
        }

        // Hydrate critical progress from IndexedDB if localStorage does not have it
        if (idbCriticalProg && !localStorage.getItem(STORAGE_KEYS.CRITICAL_PROGRESS)) {
          this._cache.criticalProgress = idbCriticalProg;
          localStorage.setItem(STORAGE_KEYS.CRITICAL_PROGRESS, JSON.stringify(idbCriticalProg));
        }

        this._initialized = true;
      } catch (err) {
        console.warn('StorageService init error:', err);
      }
    })();

    return this._initPromise;
  }

  // --- Theme ---

  getTheme() {
    return localStorage.getItem(STORAGE_KEYS.THEME) || localStorage.getItem('theme') || 'system';
  }

  setTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    localStorage.setItem('theme', theme);
    dbService.setMeta('theme', theme).catch(() => {});
    eventBus.emit('theme:changed', theme);
  }

  // --- Bookmarks ---

  getBookmarks() {
    if (this._cache.bookmarks) return this._cache.bookmarks;
    try {
      const bms = JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKMARKS)) || [];
      this._cache.bookmarks = bms;
      return bms;
    } catch {
      return [];
    }
  }

  toggleBookmark(questionId) {
    const qid = Number(questionId);
    const bookmarks = [...this.getBookmarks()];
    const index = bookmarks.indexOf(qid);
    let isBookmarked;

    if (index === -1) {
      bookmarks.push(qid);
      isBookmarked = true;
    } else {
      bookmarks.splice(index, 1);
      isBookmarked = false;
    }

    this._cache.bookmarks = bookmarks;
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));

    // Persist to IndexedDB
    dbService.saveQuestionProgress(qid, { isBookmarked }).catch(() => {});

    eventBus.emit('bookmark:changed', { questionId: qid, isBookmarked, bookmarks });
    return isBookmarked;
  }

  isBookmarked(questionId) {
    return this.getBookmarks().includes(Number(questionId));
  }

  // --- Wrong Questions ---

  getWrongQuestions() {
    if (this._cache.wrongQuestions) return this._cache.wrongQuestions;
    try {
      const wrong = JSON.parse(localStorage.getItem(STORAGE_KEYS.WRONG_QUESTIONS)) || {};
      this._cache.wrongQuestions = wrong;
      return wrong;
    } catch {
      return {};
    }
  }

  getWrongQuestionIds() {
    const wrongMap = this.getWrongQuestions();
    return Object.keys(wrongMap).map(Number);
  }

  recordWrongQuestion(questionId) {
    const qid = Number(questionId);
    const wrong = { ...this.getWrongQuestions() };
    wrong[qid] = (wrong[qid] || 0) + 1;

    this._cache.wrongQuestions = wrong;
    localStorage.setItem(STORAGE_KEYS.WRONG_QUESTIONS, JSON.stringify(wrong));

    // Save to IndexedDB
    dbService.getQuestionProgress(qid).then((existing) => {
      const attempts = (existing?.attemptsCount || 0) + 1;
      const wrongCount = (existing?.wrongCount || 0) + 1;
      dbService.saveQuestionProgress(qid, {
        status: 'wrong',
        attemptsCount: attempts,
        wrongCount,
        lastAttemptedAt: new Date().toISOString()
      }).catch(() => {});
    }).catch(() => {});

    eventBus.emit('wrongQuestion:updated', { questionId: qid, count: wrong[qid] });
  }

  recordCorrectQuestion(questionId) {
    const qid = Number(questionId);
    const wrong = { ...this.getWrongQuestions() };
    if (wrong[qid]) {
      wrong[qid] -= 1;
      if (wrong[qid] <= 0) {
        delete wrong[qid];
      }
      this._cache.wrongQuestions = wrong;
      localStorage.setItem(STORAGE_KEYS.WRONG_QUESTIONS, JSON.stringify(wrong));
      eventBus.emit('wrongQuestion:updated', { questionId: qid, count: wrong[qid] || 0 });
    }

    dbService.getQuestionProgress(qid).then((existing) => {
      const attempts = (existing?.attemptsCount || 0) + 1;
      const correctCount = (existing?.correctCount || 0) + 1;
      dbService.saveQuestionProgress(qid, {
        status: wrong[qid] ? 'wrong' : 'correct',
        attemptsCount: attempts,
        correctCount,
        lastAttemptedAt: new Date().toISOString()
      }).catch(() => {});
    }).catch(() => {});
  }

  /**
   * Completely removes a question from the wrong list (e.g. when answered correctly in wrong-redo mode)
   */
  removeWrongQuestion(questionId) {
    const qid = Number(questionId);
    const wrong = { ...this.getWrongQuestions() };
    if (wrong[qid] !== undefined) {
      delete wrong[qid];
      this._cache.wrongQuestions = wrong;
      localStorage.setItem(STORAGE_KEYS.WRONG_QUESTIONS, JSON.stringify(wrong));

      // Update in IndexedDB
      dbService.saveQuestionProgress(qid, {
        status: 'correct',
        wrongCount: 0,
        lastAttemptedAt: new Date().toISOString()
      }).catch(() => {});

      eventBus.emit('wrongQuestion:removed', { questionId: qid });
      eventBus.emit('wrongQuestion:updated', { questionId: qid, count: 0 });
      return true;
    }
    return false;
  }

  // --- Exam Cycles (Seen Questions per Exam Mode) ---

  getSeenExamQuestionIds(examType = 'standard') {
    const cacheKey = examType === 'quick' ? 'seenQuick' : 'seenStandard';
    const storageKey = examType === 'quick' ? STORAGE_KEYS.SEEN_QUICK : STORAGE_KEYS.SEEN_STANDARD;

    if (this._cache[cacheKey]) {
      return this._cache[cacheKey];
    }

    try {
      const raw = localStorage.getItem(storageKey);
      const arr = raw ? JSON.parse(raw) : [];
      const idSet = new Set(arr.map(Number));
      this._cache[cacheKey] = idSet;
      return idSet;
    } catch {
      const idSet = new Set();
      this._cache[cacheKey] = idSet;
      return idSet;
    }
  }

  addSeenExamQuestionIds(examType = 'standard', questionIds = []) {
    if (!questionIds || questionIds.length === 0) return;

    const seenSet = this.getSeenExamQuestionIds(examType);
    questionIds.forEach(id => seenSet.add(Number(id)));

    const storageKey = examType === 'quick' ? STORAGE_KEYS.SEEN_QUICK : STORAGE_KEYS.SEEN_STANDARD;
    const arr = Array.from(seenSet);
    localStorage.setItem(storageKey, JSON.stringify(arr));

    // Save to IndexedDB
    dbService.saveExamCycle(examType, arr).catch(() => {});

    eventBus.emit('examCycle:updated', { examType, seenCount: arr.length });
  }

  resetExamCycle(examType = 'standard') {
    const cacheKey = examType === 'quick' ? 'seenQuick' : 'seenStandard';
    const storageKey = examType === 'quick' ? STORAGE_KEYS.SEEN_QUICK : STORAGE_KEYS.SEEN_STANDARD;

    this._cache[cacheKey] = new Set();
    localStorage.removeItem(storageKey);

    // Reset in IndexedDB
    dbService.resetExamCycle(examType).catch(() => {});

    eventBus.emit('examCycle:reset', { examType });
  }

  getCycleStatus(examType = 'standard', totalAvailable = 600) {
    const seenSet = this.getSeenExamQuestionIds(examType);
    const seenCount = seenSet.size;
    const remainingCount = Math.max(0, totalAvailable - seenCount);
    return {
      seenCount,
      totalAvailable,
      remainingCount
    };
  }

  // --- Exam History ---

  getExamHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.EXAM_HISTORY)) || [];
    } catch {
      return [];
    }
  }

  saveExamResult(result) {
    const history = this.getExamHistory();
    const item = {
      id: Date.now(),
      date: new Date().toISOString(),
      score: result.score,
      total: result.total,
      passed: result.passed,
      failedCritical: result.failedCritical,
      durationSeconds: result.durationSeconds,
      wrongQuestionsCount: result.wrongQuestionIds ? result.wrongQuestionIds.length : 0,
      examType: result.examType,
      examTitle: result.examTitle
    };

    history.unshift(item);
    if (history.length > 50) history.pop();
    localStorage.setItem(STORAGE_KEYS.EXAM_HISTORY, JSON.stringify(history));

    // Save to IndexedDB
    dbService.saveExamHistory(item).catch(() => {});

    eventBus.emit('examHistory:saved', history[0]);
  }

  clearExamHistory() {
    localStorage.removeItem(STORAGE_KEYS.EXAM_HISTORY);
    dbService.clearExamHistory().catch(() => {});
    eventBus.emit('examHistory:cleared');
  }

  // --- Chapter Progress ---

  _getDefaultChapterProgress() {
    const chapters = {};
    for (let i = 1; i <= 6; i++) {
      chapters[i] = {
        lastIndex: 0,
        answers: {},
        updatedAt: null
      };
    }
    return {
      lastActiveChapter: 1,
      chapters
    };
  }

  getAllChapterProgress() {
    if (this._cache.chapterProgress) return this._cache.chapterProgress;

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CHAPTER_PROGRESS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const def = this._getDefaultChapterProgress();
          const merged = {
            lastActiveChapter: parsed.lastActiveChapter || 1,
            chapters: { ...def.chapters, ...(parsed.chapters || {}) }
          };
          this._cache.chapterProgress = merged;
          return merged;
        }
      }
    } catch {
      // Fallback to default
    }

    const defaultProg = this._getDefaultChapterProgress();
    this._cache.chapterProgress = defaultProg;
    return defaultProg;
  }

  getChapterProgress(chapterId = null) {
    const all = this.getAllChapterProgress();
    if (chapterId === null) {
      return all;
    }
    const chId = Number(chapterId);
    if (!all.chapters[chId]) {
      all.chapters[chId] = {
        lastIndex: 0,
        answers: {},
        updatedAt: null
      };
    }
    return all.chapters[chId];
  }

  saveChapterProgress(chapterId, data = {}) {
    const chId = Number(chapterId);
    const all = { ...this.getAllChapterProgress() };
    const currentCh = all.chapters[chId] || { lastIndex: 0, answers: {}, updatedAt: null };

    all.chapters[chId] = {
      ...currentCh,
      ...data,
      updatedAt: new Date().toISOString()
    };

    this._cache.chapterProgress = all;
    localStorage.setItem(STORAGE_KEYS.CHAPTER_PROGRESS, JSON.stringify(all));
    dbService.setMeta('chapter_progress', all).catch(() => {});
    eventBus.emit('chapterProgress:updated', { chapterId: chId, progress: all.chapters[chId] });
  }

  saveChapterAnswer(chapterId, questionId, selectedOption, index = null) {
    const chId = Number(chapterId);
    const qid = Number(questionId);
    const opt = Number(selectedOption);

    const all = { ...this.getAllChapterProgress() };
    const currentCh = all.chapters[chId] || { lastIndex: 0, answers: {}, updatedAt: null };
    const updatedAnswers = { ...(currentCh.answers || {}), [qid]: opt };

    all.chapters[chId] = {
      ...currentCh,
      answers: updatedAnswers,
      lastIndex: index !== null ? Math.max(0, Number(index)) : (currentCh.lastIndex || 0),
      updatedAt: new Date().toISOString()
    };

    this._cache.chapterProgress = all;
    localStorage.setItem(STORAGE_KEYS.CHAPTER_PROGRESS, JSON.stringify(all));
    dbService.setMeta('chapter_progress', all).catch(() => {});
    eventBus.emit('chapterProgress:updated', { chapterId: chId, questionId: qid, selectedOption: opt });
  }

  removeChapterAnswer(chapterId, questionId) {
    const chId = Number(chapterId);
    const qid = Number(questionId);

    const all = { ...this.getAllChapterProgress() };
    const currentCh = all.chapters[chId] || { lastIndex: 0, answers: {}, updatedAt: null };
    const updatedAnswers = { ...(currentCh.answers || {}) };
    delete updatedAnswers[qid];

    all.chapters[chId] = {
      ...currentCh,
      answers: updatedAnswers,
      updatedAt: new Date().toISOString()
    };

    this._cache.chapterProgress = all;
    localStorage.setItem(STORAGE_KEYS.CHAPTER_PROGRESS, JSON.stringify(all));
    dbService.setMeta('chapter_progress', all).catch(() => {});
    eventBus.emit('chapterProgress:updated', { chapterId: chId, questionId: qid, removed: true });
  }

  saveChapterLastIndex(chapterId, index) {
    const chId = Number(chapterId);
    const all = { ...this.getAllChapterProgress() };
    const currentCh = all.chapters[chId] || { lastIndex: 0, answers: {}, updatedAt: null };

    all.chapters[chId] = {
      ...currentCh,
      lastIndex: Math.max(0, Number(index)),
      updatedAt: new Date().toISOString()
    };

    this._cache.chapterProgress = all;
    localStorage.setItem(STORAGE_KEYS.CHAPTER_PROGRESS, JSON.stringify(all));
    dbService.setMeta('chapter_progress', all).catch(() => {});
  }

  saveActiveChapter(chapterId) {
    const chId = Number(chapterId);
    const all = { ...this.getAllChapterProgress(), lastActiveChapter: chId };
    this._cache.chapterProgress = all;
    localStorage.setItem(STORAGE_KEYS.CHAPTER_PROGRESS, JSON.stringify(all));
    dbService.setMeta('chapter_progress', all).catch(() => {});
  }

  getActiveChapter() {
    const all = this.getAllChapterProgress();
    return Number(all.lastActiveChapter) || 1;
  }

  resetChapterProgress(chapterId) {
    const chId = Number(chapterId);
    const all = { ...this.getAllChapterProgress() };

    all.chapters[chId] = {
      lastIndex: 0,
      answers: {},
      updatedAt: new Date().toISOString()
    };

    this._cache.chapterProgress = all;
    localStorage.setItem(STORAGE_KEYS.CHAPTER_PROGRESS, JSON.stringify(all));
    dbService.setMeta('chapter_progress', all).catch(() => {});
    eventBus.emit('chapterProgress:reset', { chapterId: chId });
  }

  resetAllChaptersProgress() {
    const def = this._getDefaultChapterProgress();
    this._cache.chapterProgress = def;
    localStorage.setItem(STORAGE_KEYS.CHAPTER_PROGRESS, JSON.stringify(def));
    dbService.setMeta('chapter_progress', def).catch(() => {});
    eventBus.emit('chapterProgress:resetAll');
  }

  getChapterStats(chapterId, questions = []) {
    const chId = Number(chapterId);
    const prog = this.getChapterProgress(chId);
    const answers = prog.answers || {};

    const qList = questions && questions.length > 0
      ? questions
      : questionService.getByChapter(chId);

    const total = qList.length;
    let answered = 0;
    let correct = 0;
    let wrong = 0;

    qList.forEach(q => {
      const userAns = answers[q.id];
      if (userAns !== undefined && userAns !== null) {
        answered++;
        if (Number(userAns) === Number(q.correct_option)) {
          correct++;
        } else {
          wrong++;
        }
      }
    });

    const percent = total > 0 ? Math.round((answered / total) * 100) : 0;
    const remaining = Math.max(0, total - answered);

    return {
      total,
      answered,
      correct,
      wrong,
      remaining,
      percent
    };
  }

  // --- Critical Questions Progress ---

  _getDefaultCriticalProgress() {
    return {
      lastIndex: 0,
      answers: {},
      updatedAt: null
    };
  }

  getCriticalProgress() {
    if (this._cache.criticalProgress) return this._cache.criticalProgress;

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CRITICAL_PROGRESS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const def = this._getDefaultCriticalProgress();
          const merged = {
            lastIndex: Math.max(0, Number(parsed.lastIndex) || 0),
            answers: (parsed.answers && typeof parsed.answers === 'object') ? parsed.answers : {},
            updatedAt: parsed.updatedAt || null
          };
          this._cache.criticalProgress = merged;
          return merged;
        }
      }
    } catch {
      // Fallback to default
    }

    const defaultProg = this._getDefaultCriticalProgress();
    this._cache.criticalProgress = defaultProg;
    return defaultProg;
  }

  saveCriticalProgress(data = {}) {
    const current = this.getCriticalProgress();
    const updated = {
      ...current,
      ...data,
      updatedAt: new Date().toISOString()
    };

    this._cache.criticalProgress = updated;
    localStorage.setItem(STORAGE_KEYS.CRITICAL_PROGRESS, JSON.stringify(updated));
    dbService.setMeta('critical_progress', updated).catch(() => {});
    eventBus.emit('criticalProgress:updated', { progress: updated });
    return updated;
  }

  saveCriticalAnswer(questionId, selectedOption, index = null) {
    const qid = Number(questionId);
    const opt = Number(selectedOption);

    const current = this.getCriticalProgress();
    const updatedAnswers = { ...(current.answers || {}), [qid]: opt };

    const updated = {
      ...current,
      answers: updatedAnswers,
      lastIndex: index !== null ? Math.max(0, Number(index)) : (current.lastIndex || 0),
      updatedAt: new Date().toISOString()
    };

    this._cache.criticalProgress = updated;
    localStorage.setItem(STORAGE_KEYS.CRITICAL_PROGRESS, JSON.stringify(updated));
    dbService.setMeta('critical_progress', updated).catch(() => {});
    eventBus.emit('criticalProgress:updated', { questionId: qid, selectedOption: opt, progress: updated });
  }

  removeCriticalAnswer(questionId) {
    const qid = Number(questionId);
    const current = this.getCriticalProgress();
    const updatedAnswers = { ...(current.answers || {}) };
    delete updatedAnswers[qid];

    const updated = {
      ...current,
      answers: updatedAnswers,
      updatedAt: new Date().toISOString()
    };

    this._cache.criticalProgress = updated;
    localStorage.setItem(STORAGE_KEYS.CRITICAL_PROGRESS, JSON.stringify(updated));
    dbService.setMeta('critical_progress', updated).catch(() => {});
    eventBus.emit('criticalProgress:updated', { questionId: qid, removed: true, progress: updated });
  }

  saveCriticalLastIndex(index) {
    const current = this.getCriticalProgress();
    const updated = {
      ...current,
      lastIndex: Math.max(0, Number(index)),
      updatedAt: new Date().toISOString()
    };

    this._cache.criticalProgress = updated;
    localStorage.setItem(STORAGE_KEYS.CRITICAL_PROGRESS, JSON.stringify(updated));
    dbService.setMeta('critical_progress', updated).catch(() => {});
  }

  resetCriticalProgress() {
    const def = this._getDefaultCriticalProgress();
    def.updatedAt = new Date().toISOString();

    this._cache.criticalProgress = def;
    localStorage.setItem(STORAGE_KEYS.CRITICAL_PROGRESS, JSON.stringify(def));
    dbService.setMeta('critical_progress', def).catch(() => {});
    eventBus.emit('criticalProgress:reset');
  }

  getCriticalStats(questions = []) {
    const prog = this.getCriticalProgress();
    const answers = prog.answers || {};

    const qList = questions && questions.length > 0
      ? questions
      : questionService.getCriticalQuestions();

    const total = qList.length;
    let answered = 0;
    let correct = 0;
    let wrong = 0;

    qList.forEach(q => {
      const userAns = answers[q.id];
      if (userAns !== undefined && userAns !== null) {
        answered++;
        if (Number(userAns) === Number(q.correct_option)) {
          correct++;
        } else {
          wrong++;
        }
      }
    });

    const percent = total > 0 ? Math.round((answered / total) * 100) : 0;
    const remaining = Math.max(0, total - answered);
    const isCompleted = total > 0 && answered === total;
    const isAllCorrect = total > 0 && correct === total;

    return {
      total,
      answered,
      correct,
      wrong,
      remaining,
      percent,
      isCompleted,
      isAllCorrect
    };
  }
}

export const StorageService = new StorageServiceImpl();
