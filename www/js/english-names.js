(function (global) {
  "use strict";
  const tier = (index) => index < 1000 ? "common" : index < 4000 ? "uncommon" : "rare";
  let pending;

  async function load() {
    const response = await fetch("data/english_names.json");
    if (!response.ok) throw new Error("English name data unavailable");
    const data = await response.json();
    const surnames = data.surnames.map((name, index) => ({
      id: "en-s:" + name, kanji: name, reading: "", rarity: tier(index)
    }));
    const givenNames = data.given.map(([name, mask], index) => ({
      id: "en-g:" + name, kanji: name, reading: "", rarity: tier(index),
      categories: ["male", "female", "neutral"].filter((_, bit) => mask & (1 << bit))
    }));
    return { surnames, givenNames };
  }

  const isEnglish = (entry) => entry.language === "en";
  global.NamaeGachaEnglish = {
    load() {
      if (!pending) pending = load().catch((error) => { pending = undefined; throw error; });
      return pending;
    },
    isEnglish,
    name(entry, separator = " ") {
      return isEnglish(entry)
        ? entry.givenName + " " + entry.surname
        : entry.surname + separator + entry.givenName;
    },
    reading(entry) {
      return isEnglish(entry) ? "" : entry.surnameReading + "　" + entry.givenNameReading;
    }
  };
})(window);
