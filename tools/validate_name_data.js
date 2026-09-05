#!/usr/bin/env node
/**
 * validate_name_data.js
 *
 * www/data/surnames.json と www/data/given_names.json を検査する。
 * アプリ本体には含めず、リリース前チェック用に単独で実行する。
 *
 * 使い方:
 *   node tools/validate_name_data.js
 *   node tools/validate_name_data.js --strict-counts   本番件数（姓10,000/名12,000）を必須にする
 *
 * 終了コード: 問題があれば1、なければ0
 */

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const strictCounts = args.includes("--strict-counts");

const DATA_DIR = path.join(__dirname, "..", "www", "data");
const SURNAMES_PATH = path.join(DATA_DIR, "surnames.json");
const GIVEN_NAMES_PATH = path.join(DATA_DIR, "given_names.json");

const ALLOWED_RARITY = ["common", "uncommon", "rare"];
const ALLOWED_CATEGORY = ["male", "female", "neutral"];
const ALLOWED_PRIMARY = ["male", "female", "unspecified"];

// ひらがな（読みで使う範囲。長音符「ー」は姓名の読みでは基本使わないため許可しない）
const HIRAGANA_ONLY = /^[\u3041-\u3096]+$/;

const errors = [];
const warnings = [];

function loadJSON(filePath, label) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (e) {
    errors.push(`[${label}] ファイルを読み込めません: ${filePath}`);
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    errors.push(`[${label}] JSON構文エラー: ${e.message}`);
    return null;
  }
}

function hasForbiddenChars(str) {
  if (typeof str !== "string") return true;
  if (str !== str.trim()) return true; // 前後空白
  if (str.length === 0) return true; // 空文字
  // 絵文字・記号・制御文字などをざっくり検出（漢字・かな・英数字・長い点以外を禁止したい場面で使用）
  return /[\u0000-\u001F\u2600-\u27BF\uD800-\uDFFF]/.test(str);
}

function validateSurnames(list) {
  if (!Array.isArray(list)) {
    errors.push("[surnames] 配列ではありません");
    return;
  }

  const ids = new Set();
  const kanjiReadingKeys = new Set();
  const idPattern = /^surname_\d{5,}$/;
  const rarityCounts = { common: 0, uncommon: 0, rare: 0 };

  list.forEach((item, index) => {
    const label = `[surnames#${index}]`;

    if (!item || typeof item !== "object") {
      errors.push(`${label} オブジェクトではありません`);
      return;
    }

    ["id", "kanji", "reading", "rarity"].forEach((key) => {
      if (!(key in item)) errors.push(`${label} 必須キー不足: ${key}`);
    });

    if (typeof item.id === "string") {
      if (!idPattern.test(item.id)) errors.push(`${label} ID形式が不正: ${item.id}`);
      if (ids.has(item.id)) errors.push(`${label} ID重複: ${item.id}`);
      ids.add(item.id);
    }

    if (hasForbiddenChars(item.kanji)) errors.push(`${label} kanjiが不正: ${JSON.stringify(item.kanji)}`);
    if (typeof item.reading !== "string" || !HIRAGANA_ONLY.test(item.reading)) {
      errors.push(`${label} readingがひらがなのみで構成されていません: ${JSON.stringify(item.reading)}`);
    }

    if (!ALLOWED_RARITY.includes(item.rarity)) {
      errors.push(`${label} rarityが不正: ${item.rarity}`);
    } else {
      rarityCounts[item.rarity]++;
    }

    if (typeof item.kanji === "string" && typeof item.reading === "string") {
      const key = `${item.kanji}::${item.reading}`;
      if (kanjiReadingKeys.has(key)) {
        errors.push(`${label} 漢字＋読みの重複: ${item.kanji}(${item.reading})`);
      }
      kanjiReadingKeys.add(key);
    }
  });

  ALLOWED_RARITY.forEach((tier) => {
    if (rarityCounts[tier] === 0) {
      errors.push(`[surnames] rarity=${tier} の候補が0件です`);
    }
  });

  console.log(`[surnames] 件数: ${list.length}`, rarityCounts);
  if (strictCounts && list.length !== 10000) {
    errors.push(`[surnames] 本番件数（10,000件）と一致しません: ${list.length}件`);
  }
}

function validateGivenNames(list) {
  if (!Array.isArray(list)) {
    errors.push("[given_names] 配列ではありません");
    return;
  }

  const ids = new Set();
  const kanjiReadingKeys = new Set();
  const idPattern = /^given_\d{5,}$/;
  const primaryCounts = { male: 0, female: 0, unspecified: 0 };
  const categoryRarityCoverage = {
    male: { common: 0, uncommon: 0, rare: 0 },
    female: { common: 0, uncommon: 0, rare: 0 },
    neutral: { common: 0, uncommon: 0, rare: 0 }
  };

  list.forEach((item, index) => {
    const label = `[given_names#${index}]`;

    if (!item || typeof item !== "object") {
      errors.push(`${label} オブジェクトではありません`);
      return;
    }

    ["id", "kanji", "reading", "primaryCategory", "categories", "rarity"].forEach((key) => {
      if (!(key in item)) errors.push(`${label} 必須キー不足: ${key}`);
    });

    if (typeof item.id === "string") {
      if (!idPattern.test(item.id)) errors.push(`${label} ID形式が不正: ${item.id}`);
      if (ids.has(item.id)) errors.push(`${label} ID重複: ${item.id}`);
      ids.add(item.id);
    }

    if (hasForbiddenChars(item.kanji)) errors.push(`${label} kanjiが不正: ${JSON.stringify(item.kanji)}`);
    if (typeof item.reading !== "string" || !HIRAGANA_ONLY.test(item.reading)) {
      errors.push(`${label} readingがひらがなのみで構成されていません: ${JSON.stringify(item.reading)}`);
    }

    if (!ALLOWED_PRIMARY.includes(item.primaryCategory)) {
      errors.push(`${label} primaryCategoryが不正: ${item.primaryCategory}`);
    } else {
      primaryCounts[item.primaryCategory]++;
    }

    if (!Array.isArray(item.categories)) {
      errors.push(`${label} categoriesが不正: ${JSON.stringify(item.categories)}`);
    } else {
      if (new Set(item.categories).size !== item.categories.length) {
        errors.push(`${label} categories内に重複があります: ${JSON.stringify(item.categories)}`);
      }
      item.categories.forEach((cat) => {
        if (!ALLOWED_CATEGORY.includes(cat)) {
          errors.push(`${label} categoriesに不正な値: ${cat}`);
        }
      });
    }

    if (!ALLOWED_RARITY.includes(item.rarity)) {
      errors.push(`${label} rarityが不正: ${item.rarity}`);
    } else if (Array.isArray(item.categories)) {
      item.categories.forEach((cat) => {
        if (categoryRarityCoverage[cat]) {
          categoryRarityCoverage[cat][item.rarity]++;
        }
      });
    }

    if (typeof item.kanji === "string" && typeof item.reading === "string") {
      const key = `${item.kanji}::${item.reading}`;
      if (kanjiReadingKeys.has(key)) {
        errors.push(`${label} 漢字＋読みの重複: ${item.kanji}(${item.reading})`);
      }
      kanjiReadingKeys.add(key);
    }
  });

  ALLOWED_CATEGORY.forEach((cat) => {
    ALLOWED_RARITY.forEach((tier) => {
      if (categoryRarityCoverage[cat][tier] === 0) {
        errors.push(`[given_names] categories=${cat} かつ rarity=${tier} の候補が0件です`);
      }
    });
  });

  console.log(`[given_names] 件数: ${list.length}`, primaryCounts);
  console.log("[given_names] カテゴリー×rarityの候補数:", categoryRarityCoverage);

  if (strictCounts) {
    if (list.length !== 12000) {
      errors.push(`[given_names] 本番件数（12,000件）と一致しません: ${list.length}件`);
    }
    if (primaryCounts.male !== 5000) errors.push(`[given_names] primaryCategory=maleが5,000件ではありません: ${primaryCounts.male}`);
    if (primaryCounts.female !== 5000) errors.push(`[given_names] primaryCategory=femaleが5,000件ではありません: ${primaryCounts.female}`);
    if (primaryCounts.unspecified !== 2000) errors.push(`[given_names] primaryCategory=unspecifiedが2,000件ではありません: ${primaryCounts.unspecified}`);
    const neutralCount = categoryRarityCoverage.neutral.common
      + categoryRarityCoverage.neutral.uncommon
      + categoryRarityCoverage.neutral.rare;
    if (neutralCount < 1 || neutralCount > 300) {
      errors.push(`[given_names] 中性的候補は1〜300件の範囲を想定しています: ${neutralCount}`);
    }
  }
}

function main() {
  console.log(`検査モード: ${strictCounts ? "本番件数を必須にする（--strict-counts）" : "サンプル/開発用（件数は参考表示のみ）"}`);

  const surnames = loadJSON(SURNAMES_PATH, "surnames");
  const givenNames = loadJSON(GIVEN_NAMES_PATH, "given_names");

  if (surnames) validateSurnames(surnames);
  if (givenNames) validateGivenNames(givenNames);

  console.log("\n=== 検査結果 ===");
  if (warnings.length) {
    console.log(`警告 ${warnings.length}件:`);
    warnings.forEach((w) => console.log(" - " + w));
  }
  if (errors.length === 0) {
    console.log("エラーなし。");
    process.exit(0);
  } else {
    console.log(`エラー ${errors.length}件:`);
    errors.forEach((e) => console.log(" - " + e));
    process.exit(1);
  }
}

main();
