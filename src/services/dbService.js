/**
 * IndexedDB Service: Client-side persistent storage for question progress,
 * exam history, exam cycles, and wrong questions.
 */

const DB_NAME = 'GPLX_STUDY_DB';
const DB_VERSION = 1;

const STORES = {
  QUESTION_PROGRESS: 'question_progress',
  EXAM_HISTORY: 'exam_history',
  EXAM_CYCLES: 'exam_cycles',
  APP_META: 'app_meta'
};

class DBService {
  constructor() {
    this.db = null;
    this.initPromise = null;
  }

  /**
   * Initializes IndexedDB and runs migration if necessary
   */
  async init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        console.warn('IndexedDB not supported in this environment, falling back to in-memory/localStorage.');
        resolve(null);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. Question Progress Store
        if (!db.objectStoreNames.contains(STORES.QUESTION_PROGRESS)) {
          const progressStore = db.createObjectStore(STORES.QUESTION_PROGRESS, { keyPath: 'id' });
          progressStore.createIndex('by_status', 'status', { unique: false });
          progressStore.createIndex('by_chapter', 'chapter', { unique: false });
          progressStore.createIndex('by_updatedAt', 'lastAttemptedAt', { unique: false });
        }

        // 2. Exam History Store
        if (!db.objectStoreNames.contains(STORES.EXAM_HISTORY)) {
          const historyStore = db.createObjectStore(STORES.EXAM_HISTORY, { keyPath: 'id' });
          historyStore.createIndex('by_examType', 'examType', { unique: false });
          historyStore.createIndex('by_date', 'date', { unique: false });
        }

        // 3. Exam Cycles Store
        if (!db.objectStoreNames.contains(STORES.EXAM_CYCLES)) {
          db.createObjectStore(STORES.EXAM_CYCLES, { keyPath: 'examType' });
        }

        // 4. App Meta Store
        if (!db.objectStoreNames.contains(STORES.APP_META)) {
          db.createObjectStore(STORES.APP_META, { keyPath: 'key' });
        }
      };

      request.onsuccess = async (event) => {
        this.db = event.target.result;
        try {
          await this.migrateFromLocalStorage();
        } catch (err) {
          console.warn('Migration from localStorage warning:', err);
        }
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event.target.error);
        resolve(null);
      };
    });

    return this.initPromise;
  }

  /**
   * Migrate existing data from localStorage to IndexedDB (runs once)
   */
  async migrateFromLocalStorage() {
    if (!this.db) return;
    const migrated = await this.getMeta('localStorage_migrated');
    if (migrated) return;

    try {
      // 1. Migrate wrong questions
      const rawWrong = localStorage.getItem('gplx_wrong_questions');
      if (rawWrong) {
        const wrongObj = JSON.parse(rawWrong);
        for (const [idStr, count] of Object.entries(wrongObj)) {
          const id = Number(idStr);
          await this.saveQuestionProgress(id, {
            status: 'wrong',
            wrongCount: Number(count) || 1,
            attemptsCount: Number(count) || 1,
            lastAttemptedAt: new Date().toISOString()
          });
        }
      }

      // 2. Migrate bookmarks
      const rawBookmarks = localStorage.getItem('gplx_bookmarks');
      if (rawBookmarks) {
        const bookmarks = JSON.parse(rawBookmarks);
        for (const id of bookmarks) {
          const current = (await this.getQuestionProgress(id)) || { id };
          await this.saveQuestionProgress(id, {
            ...current,
            isBookmarked: true
          });
        }
      }

      // 3. Migrate exam history
      const rawHistory = localStorage.getItem('gplx_exam_history');
      if (rawHistory) {
        const historyList = JSON.parse(rawHistory);
        if (Array.isArray(historyList)) {
          for (const item of historyList) {
            await this.saveExamHistory(item);
          }
        }
      }

      // 4. Migrate chapter progress
      const rawChapterProg = localStorage.getItem('gplx_chapter_progress');
      if (rawChapterProg) {
        try {
          const parsedProg = JSON.parse(rawChapterProg);
          await this.setMeta('chapter_progress', parsedProg);
        } catch {}
      }

      // 5. Migrate critical progress
      const rawCriticalProg = localStorage.getItem('gplx_critical_progress');
      if (rawCriticalProg) {
        try {
          const parsedProg = JSON.parse(rawCriticalProg);
          await this.setMeta('critical_progress', parsedProg);
        } catch {}
      }

      await this.setMeta('localStorage_migrated', true);
      console.log('IndexedDB: Successfully migrated data from localStorage.');
    } catch (e) {
      console.error('Failed to migrate data from localStorage:', e);
    }
  }

  // --- Generic Helpers ---

  async _transaction(storeName, mode, callback) {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        let result = null;

        tx.oncomplete = () => resolve(result);
        tx.onerror = (e) => reject(e.target.error);

        result = callback(store);
      } catch (err) {
        reject(err);
      }
    });
  }

  // --- Question Progress ---

  async getQuestionProgress(questionId) {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(STORES.QUESTION_PROGRESS, 'readonly');
        const store = tx.objectStore(STORES.QUESTION_PROGRESS);
        const req = store.get(Number(questionId));
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async getAllQuestionProgress() {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(STORES.QUESTION_PROGRESS, 'readonly');
        const store = tx.objectStore(STORES.QUESTION_PROGRESS);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  async saveQuestionProgress(questionId, data = {}) {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(STORES.QUESTION_PROGRESS, 'readwrite');
        const store = tx.objectStore(STORES.QUESTION_PROGRESS);
        const id = Number(questionId);

        const getReq = store.get(id);
        getReq.onsuccess = () => {
          const existing = getReq.result || {
            id,
            attemptsCount: 0,
            correctCount: 0,
            wrongCount: 0,
            status: 'unanswered',
            isBookmarked: false
          };

          const updated = {
            ...existing,
            ...data,
            id,
            lastAttemptedAt: data.lastAttemptedAt || new Date().toISOString()
          };

          store.put(updated);
        };

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  // --- Exam Cycles (Seen Questions per Exam Mode) ---

  async getExamCycle(examType) {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(STORES.EXAM_CYCLES, 'readonly');
        const store = tx.objectStore(STORES.EXAM_CYCLES);
        const req = store.get(examType);
        req.onsuccess = () => {
          resolve(req.result ? req.result.seenQuestionIds || [] : []);
        };
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  async saveExamCycle(examType, seenQuestionIds = []) {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(STORES.EXAM_CYCLES, 'readwrite');
        const store = tx.objectStore(STORES.EXAM_CYCLES);
        store.put({
          examType,
          seenQuestionIds: Array.from(new Set(seenQuestionIds.map(Number))),
          updatedAt: new Date().toISOString()
        });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  async resetExamCycle(examType) {
    return this.saveExamCycle(examType, []);
  }

  // --- Exam History ---

  async saveExamHistory(examResult) {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(STORES.EXAM_HISTORY, 'readwrite');
        const store = tx.objectStore(STORES.EXAM_HISTORY);
        const record = {
          id: examResult.id || Date.now(),
          date: examResult.date || new Date().toISOString(),
          score: examResult.score,
          total: examResult.total,
          passed: examResult.passed,
          failedCritical: examResult.failedCritical,
          durationSeconds: examResult.durationSeconds,
          wrongQuestionIds: examResult.wrongQuestionIds || [],
          examType: examResult.examType,
          examTitle: examResult.examTitle
        };
        store.put(record);
        tx.oncomplete = () => resolve(record);
        tx.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async getExamHistory(limit = 50) {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(STORES.EXAM_HISTORY, 'readonly');
        const store = tx.objectStore(STORES.EXAM_HISTORY);
        const req = store.getAll();
        req.onsuccess = () => {
          const list = req.result || [];
          list.sort((a, b) => (b.id || 0) - (a.id || 0));
          resolve(list.slice(0, limit));
        };
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  async clearExamHistory() {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(STORES.EXAM_HISTORY, 'readwrite');
        const store = tx.objectStore(STORES.EXAM_HISTORY);
        store.clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  // --- Meta Key-Value ---

  async getMeta(key) {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(STORES.APP_META, 'readonly');
        const store = tx.objectStore(STORES.APP_META);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async setMeta(key, value) {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(STORES.APP_META, 'readwrite');
        const store = tx.objectStore(STORES.APP_META);
        store.put({ key, value, updatedAt: new Date().toISOString() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  // --- Offline Pack Status ---

  async getOfflineStatus() {
    return this.getMeta('offline_pack_status');
  }

  async setOfflineStatus(statusData = {}) {
    return this.setMeta('offline_pack_status', statusData);
  }
}

export const dbService = new DBService();

