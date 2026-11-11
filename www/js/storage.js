/**
 * storage.js
 * v1.0.xの履歴を保持したまま、1件・10連グループ・チャレンジ記録を保存する。
 */
(function (global) {
  "use strict";

  const KEY_CONDITION = "namaegacha.condition";
  const KEY_HISTORY = "namaegacha.history";
  const KEY_FAVORITES = "namaegacha.favorites";
  const KEY_BEST_RECORDS = "namaegacha.challengeBestRecords";
  const KEY_SCHEMA = "namaegacha.storageSchema";
  const SCHEMA_VERSION = 2;
  const HISTORY_MAX_RESULTS = 100;
  const VALID_CONDITIONS = ["all", "male", "female", "neutral"];

  function safeGetJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (_) {
      return fallback;
    }
  }

  function safeSetJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function validEntry(entry) {
    return !!entry
      && typeof entry.surname === "string"
      && typeof entry.givenName === "string"
      && typeof entry.surnameReading === "string"
      && typeof entry.givenNameReading === "string";
  }

  function makeGroup(type, results, createdAt) {
    const timestamp = createdAt || new Date().toISOString();
    return {
      id: `${type}_${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      createdAt: timestamp,
      results: results.filter(validEntry)
    };
  }

  function trimHistory(groups) {
    const kept = [];
    let total = 0;
    for (const group of groups) {
      const size = group.results.length;
      if (total + size > HISTORY_MAX_RESULTS) break;
      kept.push(group);
      total += size;
    }
    return kept;
  }

  function normalizeHistory(raw) {
    if (!Array.isArray(raw)) return [];
    const groups = [];
    raw.forEach((item) => {
      if (item && Array.isArray(item.results)) {
        const results = item.results.filter(validEntry);
        if (results.length) {
          groups.push({
            id: typeof item.id === "string" ? item.id : makeGroup("single", results).id,
            type: item.type === "ten" ? "ten" : "single",
            createdAt: item.createdAt || results[0].createdAt || new Date().toISOString(),
            results
          });
        }
      } else if (validEntry(item)) {
        groups.push(makeGroup("single", [item], item.createdAt));
      }
    });
    return trimHistory(groups);
  }

  function sameEntry(a, b) {
    return a.surnameId === b.surnameId && a.givenNameId === b.givenNameId;
  }

  function recordKey(surname, givenName) {
    return `${String(surname).normalize("NFC")}|${String(givenName).normalize("NFC")}`;
  }

  const Storage = {
    migrate() {
      const history = normalizeHistory(safeGetJSON(KEY_HISTORY, []));
      const favorites = safeGetJSON(KEY_FAVORITES, []);
      const safeFavorites = Array.isArray(favorites) ? favorites.filter(validEntry) : [];
      const okHistory = safeSetJSON(KEY_HISTORY, history);
      const okFavorites = safeSetJSON(KEY_FAVORITES, safeFavorites);
      const okSchema = safeSetJSON(KEY_SCHEMA, SCHEMA_VERSION);
      return okHistory && okFavorites && okSchema;
    },

    getCondition() {
      const value = safeGetJSON(KEY_CONDITION, "all");
      return VALID_CONDITIONS.includes(value) ? value : "all";
    },

    setCondition(condition) {
      return VALID_CONDITIONS.includes(condition) && safeSetJSON(KEY_CONDITION, condition);
    },

    getHistoryGroups() {
      return normalizeHistory(safeGetJSON(KEY_HISTORY, []));
    },

    addHistory(entry) {
      return this.addHistoryGroup("single", [entry]);
    },

    addHistoryBatch(entries) {
      return this.addHistoryGroup("ten", entries);
    },

    addHistoryGroup(type, entries) {
      const results = Array.isArray(entries) ? entries.filter(validEntry) : [];
      if (!results.length) return false;
      const groups = this.getHistoryGroups();
      groups.unshift(makeGroup(type, results, results[0].createdAt));
      return safeSetJSON(KEY_HISTORY, trimHistory(groups));
    },

    clearHistory() {
      return safeSetJSON(KEY_HISTORY, []);
    },

    getFavorites() {
      const list = safeGetJSON(KEY_FAVORITES, []);
      return Array.isArray(list) ? list.filter(validEntry) : [];
    },

    isFavorite(surnameId, givenNameId) {
      return this.getFavorites().some(
        (item) => item.surnameId === surnameId && item.givenNameId === givenNameId
      );
    },

    addFavorite(entry) {
      if (!validEntry(entry)) return false;
      const list = this.getFavorites();
      if (list.some((item) => sameEntry(item, entry))) return true;
      list.unshift(entry);
      return safeSetJSON(KEY_FAVORITES, list);
    },

    removeFavorite(surnameId, givenNameId) {
      const list = this.getFavorites().filter(
        (item) => !(item.surnameId === surnameId && item.givenNameId === givenNameId)
      );
      return safeSetJSON(KEY_FAVORITES, list);
    },

    toggleFavorite(entry) {
      if (this.isFavorite(entry.surnameId, entry.givenNameId)) {
        this.removeFavorite(entry.surnameId, entry.givenNameId);
        return false;
      }
      this.addFavorite(entry);
      return true;
    },

    getBestRecord(surname, givenName) {
      const records = safeGetJSON(KEY_BEST_RECORDS, {});
      if (!records || typeof records !== "object") return null;
      return records[recordKey(surname, givenName)] || null;
    },

    updateBestRecord(surname, givenName, count, capped) {
      const records = safeGetJSON(KEY_BEST_RECORDS, {});
      const safeRecords = records && typeof records === "object" ? records : {};
      const key = recordKey(surname, givenName);
      const current = safeRecords[key];
      if (current && Number(current.count) <= Number(count)) {
        return { saved: true, record: current, improved: false };
      }
      const record = {
        surname,
        givenName,
        count: Number(count),
        capped: !!capped,
        updatedAt: new Date().toISOString()
      };
      safeRecords[key] = record;
      return {
        saved: safeSetJSON(KEY_BEST_RECORDS, safeRecords),
        record,
        improved: true
      };
    }
  };

  global.NamaeGachaStorage = Storage;
})(window);

