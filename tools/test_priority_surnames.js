#!/usr/bin/env node
const path = require("path");
const surnames = require(path.join(__dirname, "..", "www", "data", "surnames.json"));

const required = [
  ["佐藤", "さとう"], ["鈴木", "すずき"], ["高橋", "たかはし"],
  ["田中", "たなか"], ["渡辺", "わたなべ"], ["伊藤", "いとう"],
  ["山本", "やまもと"], ["中村", "なかむら"], ["小林", "こばやし"],
  ["加藤", "かとう"], ["吉田", "よしだ"], ["山田", "やまだ"],
  ["関", "せき"]
];

const keys = new Set(surnames.map((item) => `${item.kanji}\0${item.reading}`));
const missing = required.filter(([kanji, reading]) => !keys.has(`${kanji}\0${reading}`));
if (missing.length) {
  console.error("一般姓の必須組が不足:", missing);
  process.exit(1);
}
console.log(`一般姓の必須組 ${required.length}件: すべて収録済み`);
