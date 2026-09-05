/**
 * app.js
 * 画面遷移とイベント処理を担当する。
 * データ読み込み(fetch)、抽選(generator.js)、保存(storage.js)、広告(ads.js)を組み合わせる。
 */

(function () {
  "use strict";

  const APP_VERSION = "1.0.0";
  const PRIVACY_POLICY_URL = "https://yscaesar3-pixel.github.io/NamaeGacha-app/privacy.html";
  const DATA_LICENSE_URL = "https://www.edrdg.org/edrdg/licence.html";

  // ===== アプリの状態 =====
  const state = {
    surnames: [],
    givenNames: [],
    dataLoaded: false,
    condition: "all",
    lastPick: null, // { surnameId, givenNameId }
    currentResult: null, // 結果画面に表示中のスナップショット
    currentListTab: "history"
  };

  // ===== DOM取得ヘルパー =====
  const $ = (id) => document.getElementById(id);

  const el = {
    screens: {
      home: $("screen-home"),
      result: $("screen-result"),
      list: $("screen-list")
    },
    conditionSegment: $("condition-segment"),
    btnGenerate: $("btn-generate"),
    btnOpenList: $("btn-open-list"),
    homeLoading: $("home-loading"),
    homeError: $("home-error"),
    btnReload: $("btn-reload"),
    btnInfo: $("btn-info"),

    resultName: $("result-name"),
    resultReading: $("result-reading"),
    btnResultStar: $("btn-result-star"),
    btnResultCopy: $("btn-result-copy"),
    resultError: $("result-error"),
    btnRegenerate: $("btn-regenerate"),
    btnResultList: $("btn-result-list"),
    btnResultHome: $("btn-result-home"),
    btnResultHome2: $("btn-result-home-2"),

    tabHistory: $("tab-history"),
    tabFavorites: $("tab-favorites"),
    listItems: $("list-items"),
    listEmptyHistory: $("list-empty-history"),
    listEmptyFavorites: $("list-empty-favorites"),
    listFooterHistory: $("list-footer-history"),
    btnClearHistory: $("btn-clear-history"),
    btnListHome: $("btn-list-home"),

    toast: $("toast"),

    modalInfo: $("modal-info"),
    btnModalClose: $("btn-modal-close"),
    infoVersion: $("info-version"),
    linkDataLicense: $("link-data-license"),
    linkPrivacy: $("link-privacy"),
    btnPrivacyOptions: $("btn-privacy-options"),

    confirmClearHistory: $("confirm-clear-history"),
    btnConfirmCancel: $("btn-confirm-cancel"),
    btnConfirmDelete: $("btn-confirm-delete")
  };

  // ===== 画面切り替え =====
  function showScreen(name) {
    Object.entries(el.screens).forEach(([key, node]) => {
      node.classList.toggle("active", key === name);
    });
  }

  // ===== トースト =====
  let toastTimer = null;
  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.classList.remove("visible");
    }, 1600);
  }

  // ===== データ読み込み =====
  async function loadNameData() {
    el.homeLoading.style.display = "block";
    el.homeError.classList.remove("visible");
    el.btnReload.style.display = "none";
    el.btnGenerate.disabled = true;

    try {
      const [surnamesRes, givenNamesRes] = await Promise.all([
        fetch("data/surnames.json"),
        fetch("data/given_names.json")
      ]);

      if (!surnamesRes.ok || !givenNamesRes.ok) {
        throw new Error("HTTPエラー");
      }

      const [surnames, givenNames] = await Promise.all([
        surnamesRes.json(),
        givenNamesRes.json()
      ]);

      if (!Array.isArray(surnames) || !Array.isArray(givenNames)) {
        throw new Error("データ形式エラー");
      }

      state.surnames = surnames;
      state.givenNames = givenNames;
      state.dataLoaded = true;

      el.homeLoading.style.display = "none";
      el.btnGenerate.disabled = false;
    } catch (e) {
      console.warn("[app] name data load failed", e);
      state.dataLoaded = false;
      el.homeLoading.style.display = "none";
      el.homeError.textContent = "名前データを読み込めませんでした";
      el.homeError.classList.add("visible");
      el.btnReload.style.display = "block";
      el.btnGenerate.disabled = true;
    }
  }

  // ===== 生成条件（セグメント） =====
  function setCondition(condition, persist) {
    state.condition = condition;
    Array.from(el.conditionSegment.children).forEach((btn) => {
      btn.classList.toggle("selected", btn.dataset.condition === condition);
    });
    if (persist) {
      NamaeGachaStorage.setCondition(condition);
    }
  }

  el.conditionSegment.addEventListener("click", (event) => {
    const btn = event.target.closest(".segment-item");
    if (!btn) return;
    setCondition(btn.dataset.condition, true);
  });

  // ===== 生成処理 =====
  function attemptGenerate(onError) {
    if (!state.dataLoaded) {
      onError("名前データを読み込めませんでした");
      return null;
    }

    const outcome = NameGenerator.generate(
      state.surnames,
      state.givenNames,
      state.condition,
      state.lastPick
    );

    if (outcome.error === "NO_CANDIDATES") {
      onError("選択した条件に合う名前が見つかりませんでした。条件を変更してください。");
      return null;
    }
    if (outcome.error === "ONLY_DUPLICATE_AVAILABLE") {
      onError("この条件では直前と異なる名前を生成できませんでした。条件を変更してください。");
      return null;
    }

    const entry = outcome.result;
    state.lastPick = { surnameId: entry.surnameId, givenNameId: entry.givenNameId };
    state.currentResult = entry;
    NamaeGachaStorage.addHistory(entry);
    return entry;
  }

  function renderResult(entry) {
    el.resultName.textContent = `${entry.surname}　${entry.givenName}`;
    el.resultReading.textContent = `${entry.surnameReading}　${entry.givenNameReading}`;
    el.resultError.classList.remove("visible");
    updateStarButton(el.btnResultStar, entry);
  }

  function updateStarButton(button, entry) {
    const favorited = NamaeGachaStorage.isFavorite(entry.surnameId, entry.givenNameId);
    button.textContent = favorited ? "★" : "☆";
    button.classList.toggle("favorited", favorited);
    button.setAttribute(
      "aria-label",
      favorited ? "お気に入りから解除" : "お気に入りに登録"
    );
  }

  el.btnGenerate.addEventListener("click", () => {
    const entry = attemptGenerate((message) => {
      el.homeError.textContent = message;
      el.homeError.classList.add("visible");
    });
    if (!entry) return;
    el.homeError.classList.remove("visible");
    renderResult(entry);
    showScreen("result");
  });

  el.btnRegenerate.addEventListener("click", () => {
    const entry = attemptGenerate((message) => {
      el.resultError.textContent = message;
      el.resultError.classList.add("visible");
    });
    if (!entry) return;
    renderResult(entry);
  });

  // ===== コピー =====
  async function copyToClipboard(entry, onSuccess, onError) {
    const text = `${entry.surname} ${entry.givenName}`;
    try {
      await navigator.clipboard.writeText(text);
      onSuccess();
    } catch (e) {
      console.warn("[app] copy failed", e);
      onError();
    }
  }

  el.btnResultCopy.addEventListener("click", () => {
    if (!state.currentResult) return;
    copyToClipboard(
      state.currentResult,
      () => showToast("名前をコピーしました"),
      () => showToast("コピーに失敗しました")
    );
  });

  // ===== お気に入り（結果画面） =====
  el.btnResultStar.addEventListener("click", () => {
    if (!state.currentResult) return;
    NamaeGachaStorage.toggleFavorite(state.currentResult);
    updateStarButton(el.btnResultStar, state.currentResult);
    if (state.currentListTab === "favorites") {
      renderList();
    }
  });

  // ===== 画面遷移ボタン =====
  el.btnOpenList.addEventListener("click", () => {
    state.currentListTab = "history";
    setListTab("history");
    showScreen("list");
  });

  el.btnResultList.addEventListener("click", () => {
    state.currentListTab = "history";
    setListTab("history");
    showScreen("list");
  });

  el.btnResultHome.addEventListener("click", () => showScreen("home"));
  el.btnResultHome2.addEventListener("click", () => showScreen("home"));
  el.btnListHome.addEventListener("click", () => showScreen("home"));

  el.btnReload.addEventListener("click", () => {
    loadNameData();
  });

  // ===== 履歴・お気に入り一覧 =====
  function setListTab(tab) {
    state.currentListTab = tab;
    el.tabHistory.classList.toggle("selected", tab === "history");
    el.tabFavorites.classList.toggle("selected", tab === "favorites");
    el.listFooterHistory.style.display = tab === "history" ? "block" : "none";
    renderList();
  }

  el.tabHistory.addEventListener("click", () => setListTab("history"));
  el.tabFavorites.addEventListener("click", () => setListTab("favorites"));

  function buildListItem(entry) {
    const row = document.createElement("div");
    row.className = "list-item";

    const mainBtn = document.createElement("button");
    mainBtn.className = "list-item-main";
    const nameEl = document.createElement("div");
    nameEl.className = "list-item-name";
    nameEl.textContent = `${entry.surname}　${entry.givenName}`;
    const readingEl = document.createElement("div");
    readingEl.className = "list-item-reading";
    readingEl.textContent = `${entry.surnameReading}　${entry.givenNameReading}`;
    mainBtn.appendChild(nameEl);
    mainBtn.appendChild(readingEl);
    mainBtn.addEventListener("click", () => {
      state.currentResult = entry;
      state.lastPick = { surnameId: entry.surnameId, givenNameId: entry.givenNameId };
      renderResult(entry);
      showScreen("result");
    });

    const starBtn = document.createElement("button");
    starBtn.className = "list-item-star";
    const favorited = NamaeGachaStorage.isFavorite(entry.surnameId, entry.givenNameId);
    starBtn.textContent = favorited ? "★" : "☆";
    starBtn.classList.toggle("favorited", favorited);
    starBtn.addEventListener("click", () => {
      NamaeGachaStorage.toggleFavorite(entry);
      if (state.currentResult && sameId(state.currentResult, entry)) {
        updateStarButton(el.btnResultStar, state.currentResult);
      }
      renderList();
    });

    const copyBtn = document.createElement("button");
    copyBtn.className = "list-item-copy";
    copyBtn.textContent = "コピー";
    copyBtn.addEventListener("click", () => {
      copyToClipboard(
        entry,
        () => showToast("名前をコピーしました"),
        () => showToast("コピーに失敗しました")
      );
    });

    row.appendChild(mainBtn);
    row.appendChild(starBtn);
    row.appendChild(copyBtn);
    return row;
  }

  function sameId(a, b) {
    return a.surnameId === b.surnameId && a.givenNameId === b.givenNameId;
  }

  function renderList() {
    const list =
      state.currentListTab === "history"
        ? NamaeGachaStorage.getHistory()
        : NamaeGachaStorage.getFavorites();

    el.listItems.innerHTML = "";
    el.listEmptyHistory.classList.toggle(
      "visible",
      state.currentListTab === "history" && list.length === 0
    );
    el.listEmptyFavorites.classList.toggle(
      "visible",
      state.currentListTab === "favorites" && list.length === 0
    );

    list.forEach((entry) => {
      el.listItems.appendChild(buildListItem(entry));
    });
  }

  // ===== 履歴の全削除 =====
  el.btnClearHistory.addEventListener("click", () => {
    el.confirmClearHistory.classList.add("visible");
  });

  el.btnConfirmCancel.addEventListener("click", () => {
    el.confirmClearHistory.classList.remove("visible");
  });

  el.btnConfirmDelete.addEventListener("click", () => {
    NamaeGachaStorage.clearHistory();
    el.confirmClearHistory.classList.remove("visible");
    if (state.currentListTab === "history") {
      renderList();
    }
  });

  // ===== 情報ポップアップ =====
  el.btnInfo.addEventListener("click", () => {
    el.modalInfo.classList.add("visible");
  });
  el.btnModalClose.addEventListener("click", () => {
    el.modalInfo.classList.remove("visible");
  });
  el.modalInfo.addEventListener("click", (event) => {
    if (event.target === el.modalInfo) {
      el.modalInfo.classList.remove("visible");
    }
  });

  // ===== プライバシー設定（UMPの再表示導線） =====
  function setPrivacyOptionsButtonVisible(visible) {
    el.btnPrivacyOptions.style.display = visible ? "block" : "none";
  }

  el.btnPrivacyOptions.addEventListener("click", async () => {
    if (!window.NamaeGachaAds) return;
    const outcome = await window.NamaeGachaAds.showPrivacyOptionsForm();
    if (!outcome || !outcome.success) {
      showToast("プライバシー設定を開けませんでした");
    }
  });

  // ===== 初期化 =====
  function init() {
    el.infoVersion.textContent = APP_VERSION;
    el.linkDataLicense.href = DATA_LICENSE_URL;
    el.linkPrivacy.href = PRIVACY_POLICY_URL;

    const savedCondition = NamaeGachaStorage.getCondition();
    setCondition(savedCondition, false);

    setListTab("history");
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
