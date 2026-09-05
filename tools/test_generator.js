#!/usr/bin/env node
/**
 * test_generator.js
 *
 * generator.js の「直前と同じ姓名を絶対に返さない」ロジックを検査する。
 * - 組み合わせが複数存在する場合は必ず別の結果になること
 * - 組み合わせが実質1通りしかない場合は結果を返さず専用エラーになること
 * - 実際のサンプルデータで大量に生成しても、直前との重複や意図しないエラーが出ないこと
 *
 * 使い方: node tools/test_generator.js
 * 終了コード: 失敗があれば1、なければ0
 */

const path = require("path");

// generator.js はブラウザ用に window.NameGenerator へアタッチする形式なので、
// Node実行用にwindowをグローバルにシムしてから読み込む。
global.window = global;
require(path.join(__dirname, "..", "www", "js", "generator.js"));

let failCount = 0;

function assert(condition, message) {
  if (!condition) {
    failCount++;
    console.log("NG: " + message);
  } else {
    console.log("OK: " + message);
  }
}

function makeSurname(id, rarity) {
  return { id, kanji: `姓${id}`, reading: `せい${id}`, rarity };
}

function makeGiven(id, rarity, categories) {
  return {
    id,
    kanji: `名${id}`,
    reading: `めい${id}`,
    primaryCategory: categories[0],
    categories,
    rarity
  };
}

// ---------------------------------------------------------------
// ケース1: 姓・名ともに候補が1件ずつしかなく、直前と同じ組み合わせ
//          → 結果を返さず ONLY_DUPLICATE_AVAILABLE エラーになること
// ---------------------------------------------------------------
(function caseOnlyOneCombinationTotal() {
  const surnames = [makeSurname("s1", "common")];
  const givenNames = [makeGiven("g1", "common", ["all_test"])];
  // condition="all"なので全件が候補になる
  const lastPick = { surnameId: "s1", givenNameId: "g1" };

  const outcome = NameGenerator.generate(surnames, givenNames, "all", lastPick);
  assert(
    outcome.error === "ONLY_DUPLICATE_AVAILABLE",
    "組み合わせが1通りしかない場合はONLY_DUPLICATE_AVAILABLEを返す"
  );
  assert(!outcome.result, "組み合わせが1通りしかない場合は結果(result)を返さない");
})();

// ---------------------------------------------------------------
// ケース2: 姓は1件だけだが、名は複数ある
//          → 姓は同じでも名が変わり、直前と異なる組み合わせになること
// ---------------------------------------------------------------
(function caseOnlySurnameFixed() {
  const surnames = [makeSurname("s1", "common")];
  const givenNames = [
    makeGiven("g1", "common", ["all_test"]),
    makeGiven("g2", "uncommon", ["all_test"])
  ];
  const lastPick = { surnameId: "s1", givenNameId: "g1" };

  let sawDifferent = true;
  for (let i = 0; i < 50; i++) {
    const outcome = NameGenerator.generate(surnames, givenNames, "all", lastPick);
    if (outcome.error) {
      sawDifferent = false;
      break;
    }
    if (outcome.result.surnameId === "s1" && outcome.result.givenNameId === "g1") {
      sawDifferent = false;
      break;
    }
  }
  assert(sawDifferent, "姓が1件でも名が複数あれば毎回、直前と異なる組み合わせを返す");
})();

// ---------------------------------------------------------------
// ケース3: 名は1件だけだが、姓は複数ある（ケース2の対称パターン）
// ---------------------------------------------------------------
(function caseOnlyGivenNameFixed() {
  const surnames = [makeSurname("s1", "common"), makeSurname("s2", "rare")];
  const givenNames = [makeGiven("g1", "common", ["all_test"])];
  const lastPick = { surnameId: "s1", givenNameId: "g1" };

  let sawDifferent = true;
  for (let i = 0; i < 50; i++) {
    const outcome = NameGenerator.generate(surnames, givenNames, "all", lastPick);
    if (outcome.error) {
      sawDifferent = false;
      break;
    }
    if (outcome.result.surnameId === "s1" && outcome.result.givenNameId === "g1") {
      sawDifferent = false;
      break;
    }
  }
  assert(sawDifferent, "名が1件でも姓が複数あれば毎回、直前と異なる組み合わせを返す");
})();

// ---------------------------------------------------------------
// ケース4: 初回生成（lastPickなし）はエラーにならないこと
// ---------------------------------------------------------------
(function caseFirstGenerationHasNoLastPick() {
  const surnames = [makeSurname("s1", "common")];
  const givenNames = [makeGiven("g1", "common", ["all_test"])];
  const outcome = NameGenerator.generate(surnames, givenNames, "all", null);
  assert(!outcome.error, "lastPickがない初回生成はエラーにならない");
})();

// ---------------------------------------------------------------
// ケース5: 実データ（www/data）で大量シミュレーション
//          → 直前との重複が一度も発生しないこと、
//            意図しないエラーが発生しないこと
// ---------------------------------------------------------------
(function caseRealSampleDataSimulation() {
  const surnames = require(path.join(__dirname, "..", "www", "data", "surnames.json"));
  const givenNames = require(path.join(__dirname, "..", "www", "data", "given_names.json"));

  ["all", "male", "female", "neutral"].forEach((condition) => {
    let lastPick = null;
    let consecutiveDuplicateCount = 0;
    let unexpectedErrorCount = 0;
    const ITERATIONS = 5000;

    for (let i = 0; i < ITERATIONS; i++) {
      const outcome = NameGenerator.generate(surnames, givenNames, condition, lastPick);
      if (outcome.error) {
        unexpectedErrorCount++;
        continue;
      }
      const r = outcome.result;
      if (lastPick && lastPick.surnameId === r.surnameId && lastPick.givenNameId === r.givenNameId) {
        consecutiveDuplicateCount++;
      }
      lastPick = { surnameId: r.surnameId, givenNameId: r.givenNameId };
    }

    assert(
      consecutiveDuplicateCount === 0,
      `条件[${condition}]: ${ITERATIONS}回中、直前と同じ結果が0回である（実際: ${consecutiveDuplicateCount}回）`
    );
    assert(
      unexpectedErrorCount === 0,
      `条件[${condition}]: サンプルデータでは複数の組み合わせが存在するため、エラーが0回である（実際: ${unexpectedErrorCount}回）`
    );
  });
})();

console.log("\n=== テスト結果 ===");
if (failCount === 0) {
  console.log("すべて成功しました。");
  process.exit(0);
} else {
  console.log(`${failCount}件のテストが失敗しました。`);
  process.exit(1);
}
