#!/usr/bin/env node
const path = require("path");

global.window = global;
const memory = new Map();
global.localStorage = {
  getItem(key) { return memory.has(key) ? memory.get(key) : null; },
  setItem(key, value) { memory.set(key, String(value)); },
  removeItem(key) { memory.delete(key); }
};

require(path.join(__dirname, "..", "www", "js", "generator.js"));
require(path.join(__dirname, "..", "www", "js", "storage.js"));

let failures = 0;
function check(value, message) {
  if (value) console.log("OK:", message);
  else {
    failures++;
    console.log("NG:", message);
  }
}

const surnames = [
  { id: "s1", kanji: "関", reading: "せき", rarity: "common" },
  { id: "s2", kanji: "関", reading: "かん", rarity: "uncommon" },
  ...Array.from({ length: 20 }, (_, index) => ({
    id: `sx${index}`, kanji: `姓${index}`, reading: "せい", rarity: index < 10 ? "common" : "rare"
  }))
];
const givenNames = [
  { id: "g1", kanji: "勇太", reading: "ゆうた", rarity: "common", primaryCategory: "male", categories: ["male"] },
  { id: "g2", kanji: "勇太", reading: "はやた", rarity: "uncommon", primaryCategory: "male", categories: ["male"] },
  ...Array.from({ length: 20 }, (_, index) => ({
    id: `gx${index}`, kanji: `名${index}`, reading: "めい", rarity: index < 10 ? "common" : "rare",
    primaryCategory: "male", categories: ["male"]
  }))
];

const batch = NameGenerator.generateBatch(surnames, givenNames, "all", 10);
check(batch.results && batch.results.length === 10, "10連で10件生成できる");
check(new Set(batch.results.map((item) => `${item.surnameId}|${item.givenNameId}`)).size === 10, "10連内に完全重複がない");

const first = NameGenerator.challenge(surnames, givenNames, "関", "勇太", 0);
check(first.result && first.result.count === 1, "乱数0の初回出現回数は1");
check(NameGenerator.challenge(surnames, givenNames, "不存在", "勇太", 0.5).error === "NAME_NOT_FOUND", "未登録表記は専用エラー");

const legacy = {
  surnameId: "s1", givenNameId: "g1", surname: "関", surnameReading: "せき",
  givenName: "勇太", givenNameReading: "ゆうた", createdAt: "2026-01-01T00:00:00.000Z"
};
localStorage.setItem("namaegacha.history", JSON.stringify([legacy]));
localStorage.setItem("namaegacha.favorites", JSON.stringify([legacy]));
check(NamaeGachaStorage.migrate(), "旧保存形式を移行できる");
const migrated = NamaeGachaStorage.getHistoryGroups();
check(migrated.length === 1 && migrated[0].results[0].surname === "関", "旧履歴の表示スナップショットを維持");
check(NamaeGachaStorage.getFavorites().length === 1, "旧お気に入りを維持");

check(NamaeGachaStorage.addHistoryBatch(batch.results), "10連をグループ保存できる");
check(NamaeGachaStorage.getHistoryGroups()[0].type === "ten", "10連履歴の種別を維持");

const best1 = NamaeGachaStorage.updateBestRecord("関", "勇太", 5000, false);
const best2 = NamaeGachaStorage.updateBestRecord("関", "勇太", 9000, false);
const best3 = NamaeGachaStorage.updateBestRecord("関", "勇太", 1200, false);
check(best1.record.count === 5000 && best2.record.count === 5000, "悪い結果でベスト記録を上書きしない");
check(best3.record.count === 1200, "良い結果でベスト記録を更新する");

if (failures) {
  console.log(`\n${failures}件のテストが失敗しました。`);
  process.exit(1);
}
console.log("\n1.1.0追加機能テストはすべて成功しました。");

