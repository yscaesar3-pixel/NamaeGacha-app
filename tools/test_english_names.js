const assert = require("node:assert/strict");
const data = require("../www/data/english_names.json");
global.window = global;
require("../www/js/generator.js");
require("../www/js/english-names.js");
const store = new Map();
global.localStorage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
require("../www/js/storage.js");
let requests = 0;
global.fetch = async (url) => {
  assert.equal(url, "data/english_names.json");
  if (++requests === 1) throw new Error("simulated failed load");
  return { ok: true, json: async () => data };
};

(async () => {
  assert.equal(requests, 0);
  await assert.rejects(NamaeGachaEnglish.load());
  const [pool, reused] = await Promise.all([NamaeGachaEnglish.load(), NamaeGachaEnglish.load()]);
  assert.equal(pool, reused);
  assert.equal(requests, 2);
  const { surnames, givenNames } = pool;
  for (const list of [surnames, givenNames]) {
    assert.equal(list.length, 10000);
    assert.equal(new Set(list.map((item) => item.id)).size, 10000);
  }
  for (const condition of ["all", "male", "female", "neutral"]) {
    for (const tier of ["common", "uncommon", "rare"]) {
      assert.ok(givenNames.some((item) => item.rarity === tier && (condition === "all" || item.categories.includes(condition))));
    }
    for (let run = 0; run < 20; run++) {
      const { results } = NameGenerator.generateBatch(surnames, givenNames, condition, 10);
      assert.equal(results.length, 10);
      const names = results.map((entry) => {
        const item = givenNames.find((item) => item.id === entry.givenNameId);
        assert.ok(condition === "all" || item.categories.includes(condition));
        return NamaeGachaEnglish.name({ ...entry, language: "en" });
      });
      assert.equal(new Set(names).size, 10);
    }
  }
  const jp = { surname: "佐藤", givenName: "太郎", surnameReading: "さとう", givenNameReading: "たろう" };
  assert.equal(NamaeGachaEnglish.name(jp, "　"), "佐藤　太郎");
  assert.equal(NamaeGachaEnglish.reading(jp), "さとう　たろう");
  assert.equal(NamaeGachaEnglish.name({ surname: "Carter", givenName: "Emily", language: "en" }), "Emily Carter");
  const entry = { ...NameGenerator.generate(surnames, givenNames, "all", null).result, language: "en" };
  assert.ok(NamaeGachaStorage.addHistory(entry));
  assert.ok(NamaeGachaStorage.toggleFavorite(entry));
  NamaeGachaStorage.migrate();
  assert.deepEqual(NamaeGachaStorage.getHistoryGroups()[0].results[0], entry);
  assert.deepEqual(NamaeGachaStorage.getFavorites()[0], entry);
  console.log("English dataset, lazy load, retry, filters, 10-draw and formatting: OK");
})().catch((error) => { console.error(error); process.exitCode = 1; });
