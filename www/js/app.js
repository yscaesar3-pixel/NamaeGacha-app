/**
 * app.js - なまえガチャ 1.1.0
 */
(function () {
  "use strict";

  const APP_VERSION = "1.1.0";
  const PRIVACY_POLICY_URL = "https://yscaesar3-pixel.github.io/NamaeGacha-app/privacy.html";
  const SUPPORT_URL = "https://yscaesar3-pixel.github.io/NamaeGacha-app/support.html";
  const DATA_LICENSE_URL = "https://www.edrdg.org/edrdg/licence.html";

  // App Store公開ページのURLを設定すると、共有文へ自動追加される。
  const APP_STORE_URL = "https://apps.apple.com/jp/app/なまえガチャ/id6808911159";

  // Googleフォーム作成後にURLと事前入力用entry IDを設定する。
  const REQUEST_FORM = {
    url: "https://docs.google.com/forms/d/e/1FAIpQLSfZ78-jbyMBsg5VE_xWWk6050FabyuoVN6S6LFg_diXZHsM3g/viewform?usp=pp_url",
    typeEntry: "entry.372380863",
    writtenEntry: "entry.781372176"
  };

  const state = {
    surnames: [],
    givenNames: [],
    surnameWritten: [],
    givenWritten: [],
    surnameSet: new Set(),
    givenSet: new Set(),
    dataLoaded: false,
    condition: "all",
    lastPick: null,
    currentResult: null,
    currentResultSource: "generated",
    currentBatch: [],
    currentListTab: "history",
    challenge: {
      surname: "",
      givenName: "",
      result: null
    }
  };

  const $ = (id) => document.getElementById(id);
  const el = {
    screens: {
      home: $("screen-home"),
      result: $("screen-result"),
      ten: $("screen-ten"),
      challengeSearch: $("screen-challenge-search"),
      challengeResult: $("screen-challenge-result"),
      list: $("screen-list")
    },
    conditionSegment: $("condition-segment"),
    btnGenerate: $("btn-generate"),
    btnGenerateTen: $("btn-generate-ten"),
    btnOpenChallenge: $("btn-open-challenge"),
    btnOpenHistory: $("btn-open-history"),
    btnOpenFavorites: $("btn-open-favorites"),
    homeLoading: $("home-loading"),
    homeError: $("home-error"),
    btnReload: $("btn-reload"),
    btnInfo: $("btn-info"),

    resultName: $("result-name"),
    resultReading: $("result-reading"),
    btnResultStar: $("btn-result-star"),
    btnResultCopy: $("btn-result-copy"),
    btnResultShare: $("btn-result-share"),
    resultError: $("result-error"),
    btnRegenerate: $("btn-regenerate"),
    btnResultList: $("btn-result-list"),
    btnResultBack: $("btn-result-back"),
    btnResultHome: $("btn-result-home"),

    tenList: $("ten-list"),
    tenError: $("ten-error"),
    btnTenShare: $("btn-ten-share"),
    btnTenAgain: $("btn-ten-again"),
    btnTenHome: $("btn-ten-home"),
    btnTenHome2: $("btn-ten-home-2"),

    challengeSurname: $("challenge-surname"),
    challengeGiven: $("challenge-given"),
    surnameSuggestions: $("surname-suggestions"),
    givenSuggestions: $("given-suggestions"),
    surnameStatus: $("surname-status"),
    givenStatus: $("given-status"),
    btnRequestSurname: $("btn-request-surname"),
    btnRequestGiven: $("btn-request-given"),
    btnRunChallenge: $("btn-run-challenge"),
    challengeSearchError: $("challenge-search-error"),
    btnChallengeHome: $("btn-challenge-home"),

    challengeResultName: $("challenge-result-name"),
    challengeResultCount: $("challenge-result-count"),
    challengeBestCount: $("challenge-best-count"),
    challengeResultError: $("challenge-result-error"),
    btnChallengeAgain: $("btn-challenge-again"),
    btnChallengeShare: $("btn-challenge-share"),
    btnChallengeChange: $("btn-challenge-change"),
    btnChallengeResultBack: $("btn-challenge-result-back"),
    btnChallengeResultHome: $("btn-challenge-result-home"),

    tabHistory: $("tab-history"),
    tabFavorites: $("tab-favorites"),
    listItems: $("list-items"),
    listEmptyHistory: $("list-empty-history"),
    listEmptyFavorites: $("list-empty-favorites"),
    btnClearHistory: $("btn-clear-history"),
    btnListHome: $("btn-list-home"),

    toast: $("toast"),
    modalInfo: $("modal-info"),
    btnModalClose: $("btn-modal-close"),
    infoVersion: $("info-version"),
    linkDataLicense: $("link-data-license"),
    linkPrivacy: $("link-privacy"),
    linkSupport: $("link-support"),
    btnPrivacyOptions: $("btn-privacy-options"),

    confirmClearHistory: $("confirm-clear-history"),
    btnConfirmCancel: $("btn-confirm-cancel"),
    btnConfirmDelete: $("btn-confirm-delete")
  };

  function setMessage(node, message) {
    node.textContent = message || "";
    node.classList.toggle("visible", !!message);
  }

  function showScreen(name) {
    Object.entries(el.screens).forEach(([key, node]) => {
      node.classList.toggle("active", key === name);
    });
    const active = el.screens[name];
    const scroll = active && active.querySelector(".screen-scroll");
    if (scroll) scroll.scrollTop = 0;
  }

  function clearChallengeInput() {
    state.challenge.surname = "";
    state.challenge.givenName = "";
    state.challenge.result = null;
    el.challengeSurname.value = "";
    el.challengeGiven.value = "";
    hideSuggestions(el.surnameSuggestions);
    hideSuggestions(el.givenSuggestions);
    renderSearchStatus();
  }

  function goHome() {
    clearChallengeInput();
    showScreen("home");
  }

  let toastTimer = null;
  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("visible"), 2200);
  }

  function loadFallbackScript() {
    return new Promise((resolve, reject) => {
      if (window.NAMAE_GACHA_DATA) return resolve(window.NAMAE_GACHA_DATA);
      const script = document.createElement("script");
      script.src = "data/name_data.js";
      script.onload = () => window.NAMAE_GACHA_DATA ? resolve(window.NAMAE_GACHA_DATA) : reject(new Error("fallback missing"));
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function buildSearchIndex() {
    state.surnameSet = new Set(state.surnames.map((item) => item.kanji.normalize("NFC")));
    state.givenSet = new Set(state.givenNames.map((item) => item.kanji.normalize("NFC")));
    state.surnameWritten = Array.from(state.surnameSet);
    state.givenWritten = Array.from(state.givenSet);
  }

  async function loadNameData() {
    el.homeLoading.classList.remove("hidden");
    el.btnReload.classList.add("hidden");
    setMessage(el.homeError, "");
    el.btnGenerate.disabled = true;
    el.btnGenerateTen.disabled = true;
    try {
      let surnames;
      let givenNames;
      try {
        const [surnameResponse, givenResponse] = await Promise.all([
          fetch("data/surnames.json"),
          fetch("data/given_names.json")
        ]);
        if (!surnameResponse.ok || !givenResponse.ok) throw new Error("HTTP");
        [surnames, givenNames] = await Promise.all([
          surnameResponse.json(),
          givenResponse.json()
        ]);
      } catch (fetchError) {
        const fallback = await loadFallbackScript();
        surnames = fallback.surnames;
        givenNames = fallback.givenNames;
      }
      if (!Array.isArray(surnames) || !Array.isArray(givenNames)) throw new Error("FORMAT");
      state.surnames = surnames;
      state.givenNames = givenNames;
      buildSearchIndex();
      state.dataLoaded = true;
      el.homeLoading.classList.add("hidden");
      el.btnGenerate.disabled = false;
      el.btnGenerateTen.disabled = false;
    } catch (error) {
      console.warn("[app] name data load failed", error);
      state.dataLoaded = false;
      el.homeLoading.classList.add("hidden");
      el.btnReload.classList.remove("hidden");
      setMessage(el.homeError, "名前データを読み込めませんでした。アプリを再起動するか、再読み込みしてください。");
    }
  }

  function setCondition(condition, persist) {
    state.condition = condition;
    Array.from(el.conditionSegment.children).forEach((button) => {
      const selected = button.dataset.condition === condition;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-selected", String(selected));
    });
    if (persist) NamaeGachaStorage.setCondition(condition);
  }

  el.conditionSegment.addEventListener("click", (event) => {
    const button = event.target.closest(".segment-item");
    if (button) setCondition(button.dataset.condition, true);
  });

  function generationError(error) {
    if (error === "NO_CANDIDATES") {
      return "選択した条件に合う名前が見つかりませんでした。条件を変更してください。";
    }
    if (error === "ONLY_DUPLICATE_AVAILABLE") {
      return "この条件では直前と異なる名前を生成できませんでした。";
    }
    return "名前を生成できませんでした。もう一度お試しください。";
  }

  function generateSingle(saveHistory = true) {
    if (!state.dataLoaded) return { error: "DATA_NOT_LOADED" };
    const outcome = NameGenerator.generate(
      state.surnames,
      state.givenNames,
      state.condition,
      state.lastPick
    );
    if (outcome.error) return outcome;
    const entry = outcome.result;
    state.lastPick = { surnameId: entry.surnameId, givenNameId: entry.givenNameId };
    if (saveHistory && !NamaeGachaStorage.addHistory(entry)) {
      showToast("結果を履歴に保存できませんでした");
    }
    return { result: entry };
  }

  function renderResult(entry, source) {
    state.currentResult = entry;
    state.currentResultSource = source;
    el.resultName.textContent = `${entry.surname}　${entry.givenName}`;
    el.resultReading.textContent = `${entry.surnameReading}　${entry.givenNameReading}`;
    updateStarButton(el.btnResultStar, entry);
    setMessage(el.resultError, "");
    const generated = source === "generated";
    el.btnRegenerate.classList.toggle("hidden", !generated);
    el.btnResultList.classList.toggle("hidden", !generated);
    showScreen("result");
  }

  function updateStarButton(button, entry) {
    const favorited = NamaeGachaStorage.isFavorite(entry.surnameId, entry.givenNameId);
    button.textContent = favorited ? "★" : "☆";
    button.classList.toggle("favorited", favorited);
    button.setAttribute("aria-label", favorited ? "お気に入りから解除" : "お気に入りに登録");
  }

  el.btnGenerate.addEventListener("click", () => {
    const outcome = generateSingle(true);
    if (outcome.error) {
      setMessage(el.homeError, generationError(outcome.error));
      return;
    }
    setMessage(el.homeError, "");
    renderResult(outcome.result, "generated");
  });

  el.btnRegenerate.addEventListener("click", () => {
    const outcome = generateSingle(true);
    if (outcome.error) {
      setMessage(el.resultError, generationError(outcome.error));
      return;
    }
    renderResult(outcome.result, "generated");
  });

  async function copyEntry(entry) {
    try {
      await navigator.clipboard.writeText(`${entry.surname} ${entry.givenName}`);
      showToast("姓名をコピーしました");
    } catch (error) {
      console.warn("[app] copy failed", error);
      showToast("コピーできませんでした");
    }
  }

  el.btnResultCopy.addEventListener("click", () => {
    if (state.currentResult) copyEntry(state.currentResult);
  });

  el.btnResultStar.addEventListener("click", () => {
    if (!state.currentResult) return;
    NamaeGachaStorage.toggleFavorite(state.currentResult);
    updateStarButton(el.btnResultStar, state.currentResult);
  });

  async function performShare(button, callback) {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "画像を準備中…";
    try {
      const result = await callback();
      if (result && result.downloaded) showToast("共有画像を保存しました");
    } catch (error) {
      console.warn("[app] share failed", error);
      showToast("共有画像を作成できませんでした");
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  el.btnResultShare.addEventListener("click", () => {
    if (!state.currentResult) return;
    performShare(el.btnResultShare, () => NamaeGachaShare.single(state.currentResult, APP_STORE_URL));
  });

  el.btnResultBack.addEventListener("click", () => {
    if (state.currentResultSource === "ten") showScreen("ten");
    else if (state.currentResultSource === "history" || state.currentResultSource === "favorite") showScreen("list");
    else goHome();
  });
  el.btnResultHome.addEventListener("click", goHome);
  el.btnResultList.addEventListener("click", () => openList("history"));

  function generateTen() {
    if (!state.dataLoaded) return { error: "DATA_NOT_LOADED" };
    const outcome = NameGenerator.generateBatch(
      state.surnames,
      state.givenNames,
      state.condition,
      10
    );
    if (!outcome.results || !outcome.results.length) return outcome;
    state.currentBatch = outcome.results;
    const last = state.currentBatch[state.currentBatch.length - 1];
    state.lastPick = { surnameId: last.surnameId, givenNameId: last.givenNameId };
    if (!NamaeGachaStorage.addHistoryBatch(state.currentBatch)) {
      showToast("10連結果を履歴に保存できませんでした");
    }
    return outcome;
  }

  function renderTen() {
    el.tenList.innerHTML = "";
    state.currentBatch.forEach((entry, index) => {
      const row = document.createElement("article");
      row.className = "ten-item";
      row.style.animationDelay = `${index * 0.07}s`;

      const number = document.createElement("span");
      number.className = "ten-number";
      number.textContent = String(index + 1).padStart(2, "0");

      const main = document.createElement("button");
      main.className = "ten-main";
      main.innerHTML = `<div class="ten-name"></div><div class="ten-reading"></div>`;
      main.querySelector(".ten-name").textContent = `${entry.surname}　${entry.givenName}`;
      main.querySelector(".ten-reading").textContent = `${entry.surnameReading}　${entry.givenNameReading}`;
      main.addEventListener("click", () => renderResult(entry, "ten"));

      const star = document.createElement("button");
      star.className = "ten-star";
      updateStarButton(star, entry);
      star.addEventListener("click", () => {
        NamaeGachaStorage.toggleFavorite(entry);
        updateStarButton(star, entry);
      });

      row.append(number, main, star);
      el.tenList.appendChild(row);
    });
  }

  function runTen() {
    setMessage(el.tenError, "");
    const outcome = generateTen();
    if (outcome.error && (!outcome.results || !outcome.results.length)) {
      setMessage(el.homeError, generationError(outcome.error));
      return;
    }
    renderTen();
    if (outcome.error) {
      setMessage(el.tenError, "この条件では10件生成できなかったため、取得できた名前だけを表示しています。");
    }
    showScreen("ten");
  }

  el.btnGenerateTen.addEventListener("click", runTen);
  el.btnTenAgain.addEventListener("click", runTen);
  el.btnTenShare.addEventListener("click", () => {
    if (state.currentBatch.length) {
      performShare(el.btnTenShare, () => NamaeGachaShare.ten(state.currentBatch, APP_STORE_URL));
    }
  });
  el.btnTenHome.addEventListener("click", goHome);
  el.btnTenHome2.addEventListener("click", goHome);

  function normalizeWritten(value) {
    return String(value || "").normalize("NFC").trim().replace(/[　\s]+/g, "");
  }

  function suggestionsFor(source, query) {
    if (!query) return [];
    const prefix = [];
    const partial = [];
    for (const value of source) {
      if (value.startsWith(query)) prefix.push(value);
      else if (value.includes(query)) partial.push(value);
      if (prefix.length >= 10) break;
    }
    if (prefix.length < 10) {
      for (const value of partial) {
        prefix.push(value);
        if (prefix.length >= 10) break;
      }
    }
    return prefix;
  }

  function hideSuggestions(node) {
    node.classList.remove("visible");
    node.innerHTML = "";
  }

  function renderSuggestions(type) {
    const input = type === "surname" ? el.challengeSurname : el.challengeGiven;
    const node = type === "surname" ? el.surnameSuggestions : el.givenSuggestions;
    const source = type === "surname" ? state.surnameWritten : state.givenWritten;
    const query = normalizeWritten(input.value);
    hideSuggestions(node);
    if (!query) return;
    suggestionsFor(source, query).forEach((value) => {
      const button = document.createElement("button");
      button.className = "suggestion-button";
      button.type = "button";
      button.textContent = value;
      button.addEventListener("pointerdown", (event) => event.preventDefault());
      button.addEventListener("click", () => {
        input.value = value;
        hideSuggestions(node);
        renderSearchStatus();
      });
      node.appendChild(button);
    });
    node.classList.toggle("visible", node.children.length > 0);
  }

  function fieldState(type) {
    const input = type === "surname" ? el.challengeSurname : el.challengeGiven;
    const set = type === "surname" ? state.surnameSet : state.givenSet;
    const value = normalizeWritten(input.value);
    return { value, registered: !!value && set.has(value) };
  }

  function renderFieldStatus(type, committed) {
    const status = type === "surname" ? el.surnameStatus : el.givenStatus;
    const request = type === "surname" ? el.btnRequestSurname : el.btnRequestGiven;
    const current = fieldState(type);
    status.className = "field-status";
    request.classList.add("hidden");
    if (!current.value) {
      status.textContent = "";
    } else if (current.registered) {
      status.textContent = "✓ 登録されています";
      status.classList.add("success");
    } else if (committed) {
      status.textContent = `「${current.value}」は現在登録されていません`;
      status.classList.add("error");
      request.classList.remove("hidden");
    } else {
      status.textContent = "";
    }
    return current;
  }

  function renderSearchStatus(committedType) {
    const surname = renderFieldStatus("surname", committedType === "surname" || committedType === "both");
    const given = renderFieldStatus("given", committedType === "given" || committedType === "both");
    el.btnRunChallenge.disabled = !(surname.registered && given.registered);
    setMessage(el.challengeSearchError, "");
  }

  function bindSearchInput(type, input, suggestions) {
    let composing = false;
    input.addEventListener("compositionstart", () => { composing = true; });
    input.addEventListener("compositionend", () => {
      composing = false;
      renderSuggestions(type);
      renderSearchStatus();
    });
    input.addEventListener("input", () => {
      if (composing) return;
      renderSuggestions(type);
      renderSearchStatus();
    });
    input.addEventListener("focus", () => renderSuggestions(type));
    input.addEventListener("blur", () => {
      setTimeout(() => {
        hideSuggestions(suggestions);
        renderSearchStatus(type);
      }, 120);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        input.blur();
        renderSearchStatus(type);
      }
    });
  }

  bindSearchInput("surname", el.challengeSurname, el.surnameSuggestions);
  bindSearchInput("given", el.challengeGiven, el.givenSuggestions);

  document.querySelectorAll(".input-clear").forEach((button) => {
    button.addEventListener("click", () => {
      const input = $(button.dataset.target);
      input.value = "";
      input.focus();
      renderSearchStatus();
      if (input === el.challengeSurname) hideSuggestions(el.surnameSuggestions);
      else hideSuggestions(el.givenSuggestions);
    });
  });

  async function openRequest(type) {
    const current = fieldState(type);
    if (!current.value) return;
    if (!REQUEST_FORM.url) {
      showToast("追加リクエストフォームは準備中です");
      return;
    }
    try {
      const url = new URL(REQUEST_FORM.url);
      if (REQUEST_FORM.typeEntry) url.searchParams.set(REQUEST_FORM.typeEntry, type === "surname" ? "姓" : "名");
      if (REQUEST_FORM.writtenEntry) url.searchParams.set(REQUEST_FORM.writtenEntry, current.value);
      const Browser = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser;
      if (Browser) {
        await Browser.open({ url: url.toString() });
      } else {
        window.open(url.toString(), "_blank", "noopener");
      }
    } catch (error) {
      showToast("リクエストフォームを開けませんでした");
    }
  }

  el.btnRequestSurname.addEventListener("click", () => { openRequest("surname"); });
  el.btnRequestGiven.addEventListener("click", () => { openRequest("given"); });

  function formatCount(count, capped) {
    return capped ? "1兆回以上" : `${Number(count).toLocaleString("ja-JP")}回目`;
  }

  function runChallenge() {
    const surname = fieldState("surname");
    const given = fieldState("given");
    renderSearchStatus("both");
    if (!surname.registered || !given.registered) return;

    const outcome = NameGenerator.challenge(
      state.surnames,
      state.givenNames,
      surname.value,
      given.value
    );
    if (outcome.error) {
      setMessage(el.challengeSearchError, "結果を計算できませんでした。もう一度お試しください。");
      return;
    }
    const result = outcome.result;
    const bestUpdate = NamaeGachaStorage.updateBestRecord(
      surname.value,
      given.value,
      result.count,
      result.capped
    );
    state.challenge.surname = surname.value;
    state.challenge.givenName = given.value;
    state.challenge.result = {
      surname: surname.value,
      givenName: given.value,
      count: result.count,
      capped: result.capped,
      bestCount: bestUpdate.record.count,
      bestCapped: bestUpdate.record.capped
    };
    renderChallengeResult();
    showScreen("challengeResult");
  }

  function renderChallengeResult() {
    const result = state.challenge.result;
    if (!result) return;
    el.challengeResultName.textContent = `${result.surname} ${result.givenName}さんは`;
    el.challengeResultCount.textContent = formatCount(result.count, result.capped);
    el.challengeBestCount.textContent = formatCount(result.bestCount, result.bestCapped);
    setMessage(el.challengeResultError, "");
  }

  el.btnRunChallenge.addEventListener("click", runChallenge);
  el.btnChallengeAgain.addEventListener("click", runChallenge);
  el.btnChallengeShare.addEventListener("click", () => {
    if (state.challenge.result) {
      performShare(el.btnChallengeShare, () => NamaeGachaShare.challenge(state.challenge.result, APP_STORE_URL));
    }
  });
  el.btnChallengeChange.addEventListener("click", () => showScreen("challengeSearch"));
  el.btnChallengeResultBack.addEventListener("click", () => showScreen("challengeSearch"));
  el.btnChallengeResultHome.addEventListener("click", goHome);
  el.btnChallengeHome.addEventListener("click", goHome);

  function openChallenge() {
    renderSearchStatus();
    showScreen("challengeSearch");
  }

  function sameId(a, b) {
    return a.surnameId === b.surnameId && a.givenNameId === b.givenNameId;
  }

  function buildSavedNameRow(entry, source) {
    const row = document.createElement("div");
    row.className = source === "favorite" ? "favorite-row" : "saved-name-row";

    const main = document.createElement("button");
    main.className = "saved-name-main";
    main.innerHTML = `<div class="favorite-name"></div><div class="favorite-reading"></div>`;
    main.querySelector(".favorite-name").textContent = `${entry.surname}　${entry.givenName}`;
    main.querySelector(".favorite-reading").textContent = `${entry.surnameReading}　${entry.givenNameReading}`;
    main.addEventListener("click", () => renderResult(entry, source));

    const star = document.createElement("button");
    star.className = "saved-star";
    updateStarButton(star, entry);
    star.addEventListener("click", () => {
      NamaeGachaStorage.toggleFavorite(entry);
      if (state.currentResult && sameId(state.currentResult, entry)) {
        updateStarButton(el.btnResultStar, entry);
      }
      renderList();
    });

    const copy = document.createElement("button");
    copy.className = "saved-copy";
    copy.textContent = "コピー";
    copy.addEventListener("click", () => copyEntry(entry));

    row.append(main, star, copy);
    return row;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit"
    }).format(date);
  }

  function buildHistoryGroup(group) {
    if (group.type !== "ten" && group.results.length === 1) {
      const wrapper = document.createElement("div");
      wrapper.className = "history-group";
      wrapper.appendChild(buildSavedNameRow(group.results[0], "history"));
      return wrapper;
    }

    const wrapper = document.createElement("article");
    wrapper.className = "history-group";
    const header = document.createElement("button");
    header.className = "history-group-header";
    const title = document.createElement("div");
    title.innerHTML = `<div class="history-group-title">10連ガチャ</div><div class="history-group-date"></div>`;
    title.querySelector(".history-group-date").textContent = formatDate(group.createdAt);
    const count = document.createElement("span");
    count.className = "history-group-count";
    count.textContent = `${group.results.length}件を見る`;
    header.append(title, count);

    const results = document.createElement("div");
    results.className = "history-results";
    group.results.forEach((entry) => results.appendChild(buildSavedNameRow(entry, "history")));
    header.addEventListener("click", () => wrapper.classList.toggle("expanded"));
    wrapper.append(header, results);
    return wrapper;
  }

  function renderList() {
    el.listItems.innerHTML = "";
    const history = state.currentListTab === "history";
    const list = history ? NamaeGachaStorage.getHistoryGroups() : NamaeGachaStorage.getFavorites();
    el.listEmptyHistory.classList.toggle("visible", history && list.length === 0);
    el.listEmptyFavorites.classList.toggle("visible", !history && list.length === 0);
    el.btnClearHistory.classList.toggle("hidden", !history || list.length === 0);

    list.forEach((item) => {
      el.listItems.appendChild(history ? buildHistoryGroup(item) : buildSavedNameRow(item, "favorite"));
    });
  }

  function openList(tab) {
    state.currentListTab = tab;
    el.tabHistory.classList.toggle("selected", tab === "history");
    el.tabFavorites.classList.toggle("selected", tab === "favorites");
    renderList();
    showScreen("list");
  }

  el.btnOpenHistory.addEventListener("click", () => openList("history"));
  el.btnOpenFavorites.addEventListener("click", () => openList("favorites"));
  el.tabHistory.addEventListener("click", () => openList("history"));
  el.tabFavorites.addEventListener("click", () => openList("favorites"));
  el.btnListHome.addEventListener("click", goHome);

  el.btnClearHistory.addEventListener("click", () => {
    el.confirmClearHistory.classList.add("visible");
    el.confirmClearHistory.setAttribute("aria-hidden", "false");
  });
  el.btnConfirmCancel.addEventListener("click", () => {
    el.confirmClearHistory.classList.remove("visible");
    el.confirmClearHistory.setAttribute("aria-hidden", "true");
  });
  el.btnConfirmDelete.addEventListener("click", () => {
    NamaeGachaStorage.clearHistory();
    el.confirmClearHistory.classList.remove("visible");
    el.confirmClearHistory.setAttribute("aria-hidden", "true");
    renderList();
  });

  el.btnOpenChallenge.addEventListener("click", openChallenge);
  el.btnReload.addEventListener("click", loadNameData);

  function openInfo() {
    el.modalInfo.classList.add("visible");
    el.modalInfo.setAttribute("aria-hidden", "false");
  }
  function closeInfo() {
    el.modalInfo.classList.remove("visible");
    el.modalInfo.setAttribute("aria-hidden", "true");
  }
  el.btnInfo.addEventListener("click", openInfo);
  el.btnModalClose.addEventListener("click", closeInfo);
  el.modalInfo.addEventListener("click", (event) => {
    if (event.target === el.modalInfo) closeInfo();
  });

  function setPrivacyOptionsButtonVisible(visible) {
    el.btnPrivacyOptions.classList.toggle("hidden", !visible);
  }
  el.btnPrivacyOptions.addEventListener("click", async () => {
    if (!window.NamaeGachaAds) return;
    const outcome = await window.NamaeGachaAds.showPrivacyOptionsForm();
    if (!outcome || !outcome.success) showToast("プライバシー設定を開けませんでした");
  });

  function init() {
    NamaeGachaStorage.migrate();
    el.infoVersion.textContent = APP_VERSION;
    el.linkDataLicense.href = DATA_LICENSE_URL;
    el.linkPrivacy.href = PRIVACY_POLICY_URL;
    el.linkSupport.href = SUPPORT_URL;
    setCondition(NamaeGachaStorage.getCondition(), false);
    renderSearchStatus();
    showScreen("home");
    loadNameData();

    if (window.NamaeGachaAds) {
      window.NamaeGachaAds.setOnPrivacyOptionsChange(setPrivacyOptionsButtonVisible);
      window.NamaeGachaAds.init();
    } else {
      setPrivacyOptionsButtonVisible(false);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();

