/**
 * storage.js
 * localStorageを使った端末内保存。
 * 保存に失敗しても例外を投げず、呼び出し側に成功/失敗を返すだけにする
 * （名前生成そのものは保存失敗の影響を受けない）。
 */

(function (global) {
  "use strict";

  const KEY_CONDITION = "namaegacha.condition";
  const KEY_HISTORY = "namaegacha.history";
  const KEY_FAVORITES = "namaegacha.favorites";

  const HISTORY_MAX = 100;
  const VALID_CONDITIONS = ["all", "male", "female", "neutral"];

  function safeGetJSON(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  function safeSetJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function sameEntry(a, b) {
    return a.surnameId === b.surnameId && a.givenNameId === b.givenNameId;
  }

  const Storage = {
    getCondition() {
      const value = safeGetJSON(KEY_CONDITION, "all");
      return VALID_CONDITIONS.includes(value) ? value : "all";
    },

    setCondition(condition) {
      if (!VALID_CONDITIONS.includes(condition)) return false;
      return safeSetJSON(KEY_CONDITION, condition);
    },

    getHistory() {
      const list = safeGetJSON(KEY_HISTORY, []);
      return Array.isArray(list) ? list : [];
    },

    addHistory(entry) {
      const list = this.getHistory();
      list.unshift(entry);
      if (list.length > HISTORY_MAX) {
        list.length = HISTORY_MAX;
      }
      return safeSetJSON(KEY_HISTORY, list);
    },

    clearHistory() {
      return safeSetJSON(KEY_HISTORY, []);
    },

    getFavorites() {
      const list = safeGetJSON(KEY_FAVORITES, []);
      return Array.isArray(list) ? list : [];
    },

    isFavorite(surnameId, givenNameId) {
      const list = this.getFavorites();
      return list.some((item) => item.surnameId === surnameId && item.givenNameId === givenNameId);
    },

    addFavorite(entry) {
      const list = this.getFavorites();
      if (list.some((item) => sameEntry(item, entry))) {
        return true; // 既に登録済みなら何もしない
      }
      list.unshift(entry);
      return safeSetJSON(KEY_FAVORITES, list);
    },

    removeFavorite(surnameId, givenNameId) {
      const list = this.getFavorites().filter(
        (item) => !(item.surnameId === surnameId && item.givenNameId === givenNameId)
      );
      return safeSetJSON(KEY_FAVORITES, list);
    },

    /**
     * お気に入りの登録/解除を切り替える。
     * @returns {boolean} 切り替え後にお気に入りに登録されていればtrue
     */
    toggleFavorite(entry) {
      if (this.isFavorite(entry.surnameId, entry.givenNameId)) {
        this.removeFavorite(entry.surnameId, entry.givenNameId);
        return false;
      }
      this.addFavorite(entry);
      return true;
    }
  };

  global.NamaeGachaStorage = Storage;
})(window);
