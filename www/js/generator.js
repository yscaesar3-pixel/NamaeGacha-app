/**
 * generator.js
 * 姓名データの抽選ロジック。
 * データ読み込み（fetch）はstorage.jsではなくapp.jsが行い、
 * このモジュールには読み込み済みの配列を渡す。
 */

(function (global) {
  "use strict";

  // 珍しさ区分の抽選確率。将来ここだけ変更すれば比率調整できる。
  const RARITY_WEIGHTS = {
    common: 60,
    uncommon: 30,
    rare: 10
  };

  const RARITY_ORDER = ["common", "uncommon", "rare"];

  function weightedPick(weightMap) {
    const entries = Object.entries(weightMap);
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let r = Math.random() * total;
    for (const [key, w] of entries) {
      if (r < w) return key;
      r -= w;
    }
    return entries[entries.length - 1][0];
  }

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function groupByRarity(list) {
    const groups = { common: [], uncommon: [], rare: [] };
    for (const item of list) {
      if (groups[item.rarity]) {
        groups[item.rarity].push(item);
      }
    }
    return groups;
  }

  /**
   * 珍しさ区分を抽選し、その区分の候補が0件なら
   * 候補が存在する別区分の中から重み比率を保ったまま再抽選する。
   * 全区分が0件の場合はnullを返す（呼び出し側でエラー扱いにする）。
   */
  function pickByRarity(list) {
    const groups = groupByRarity(list);
    const availableTiers = RARITY_ORDER.filter((tier) => groups[tier].length > 0);
    if (availableTiers.length === 0) return null;

    const weightsForAvailable = {};
    availableTiers.forEach((tier) => {
      weightsForAvailable[tier] = RARITY_WEIGHTS[tier];
    });

    const chosenTier = weightedPick(weightsForAvailable);
    return pickRandom(groups[chosenTier]);
  }

  /**
   * 生成条件（all / male / female / neutral）に合う名の候補を返す。
   * 同一レコードが複数カテゴリーに所属していても配列内では1回だけ現れる
   * （元データ自体がID単位で一意なため、フィルタするだけで重複は起きない）。
   */
  function filterGivenNamesByCondition(givenNames, condition) {
    if (condition === "all") {
      return givenNames.slice();
    }
    return givenNames.filter(
      (item) => Array.isArray(item.categories) && item.categories.includes(condition)
    );
  }

  function isSamePick(lastPick, surname, givenName) {
    return (
      !!lastPick &&
      lastPick.surnameId === surname.id &&
      lastPick.givenNameId === givenName.id
    );
  }

  /**
   * 乱数による再抽選で直前と異なる組み合わせに解決できなかった場合の
   * 確定的フォールバック。「条件内に直前と異なる組み合わせが存在するか」を
   * 実際に調べたうえで、存在すれば必ずそれを返し、存在しなければnullを返す。
   *
   * 姓を直前と別のものに変えられるならそれで確実に別組み合わせになる。
   * 姓の候補が1件しかない場合のみ、名を直前と別のものに変える。
   * どちらも1件しかない（＝組み合わせが実質1通りしかない）場合だけnullになる。
   */
  function resolveDifferentFromLast(surnames, candidateGivenNames, lastPick) {
    const otherSurnames = surnames.filter((s) => s.id !== lastPick.surnameId);
    if (otherSurnames.length > 0) {
      return {
        surname: pickByRarity(otherSurnames),
        givenName: pickByRarity(candidateGivenNames)
      };
    }

    const otherGivenNames = candidateGivenNames.filter((g) => g.id !== lastPick.givenNameId);
    if (otherGivenNames.length > 0) {
      return {
        surname: pickByRarity(surnames),
        givenName: pickByRarity(otherGivenNames)
      };
    }

    // 姓・名ともに候補が1件ずつしかなく、それが直前の結果と同一 = 別組み合わせが存在しない
    return null;
  }

  const NameGenerator = {
    RARITY_WEIGHTS,

    /**
     * @param {Array} surnames 姓データ配列
     * @param {Array} givenNames 名データ配列
     * @param {string} condition 'all' | 'male' | 'female' | 'neutral'
     * @param {{surnameId:string, givenNameId:string}|null} lastPick 直前の生成結果
     * @returns {{result:Object}|{error:"NO_CANDIDATES"|"ONLY_DUPLICATE_AVAILABLE"}}
     */
    generate(surnames, givenNames, condition, lastPick) {
      const candidateGivenNames = filterGivenNamesByCondition(givenNames, condition);

      if (candidateGivenNames.length === 0) {
        return { error: "NO_CANDIDATES" };
      }
      if (!surnames || surnames.length === 0) {
        return { error: "NO_CANDIDATES" };
      }

      // まずは通常の重み付き抽選を数回試す（ほとんどの場合はこれで直前と別の結果になる）。
      const MAX_RANDOM_ATTEMPTS = 10;
      let picked = null;

      for (let attempt = 0; attempt < MAX_RANDOM_ATTEMPTS; attempt++) {
        const surname = pickByRarity(surnames);
        const givenName = pickByRarity(candidateGivenNames);

        if (!surname || !givenName) {
          return { error: "NO_CANDIDATES" };
        }

        if (!isSamePick(lastPick, surname, givenName)) {
          picked = { surname, givenName };
          break;
        }
      }

      // 乱数だけでは解決できなかった場合（候補が少ない等）は、
      // 直前と異なる組み合わせが実際に存在するかを確認したうえで確定的に決める。
      // 存在しなければ「同じ結果を返す」のではなく専用エラーを返す。
      if (!picked && lastPick) {
        picked = resolveDifferentFromLast(surnames, candidateGivenNames, lastPick);
        if (!picked) {
          return { error: "ONLY_DUPLICATE_AVAILABLE" };
        }
      }

      if (!picked) {
        // lastPickが無い（初回生成）のにpickedが決まらないのはデータが空の場合のみ
        return { error: "NO_CANDIDATES" };
      }

      return {
        result: {
          surnameId: picked.surname.id,
          givenNameId: picked.givenName.id,
          surname: picked.surname.kanji,
          surnameReading: picked.surname.reading,
          givenName: picked.givenName.kanji,
          givenNameReading: picked.givenName.reading,
          createdAt: new Date().toISOString()
        }
      };
    }
  };

  global.NameGenerator = NameGenerator;
})(window);
