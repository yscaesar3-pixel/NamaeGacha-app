/**
 * ads.js
 * Google AdMobのバナー広告のみを扱う。
 * インタースティシャル・リワード・アプリ起動広告は実装しない。
 *
 * 重要：
 * - @capacitor-community/admob をESモジュールとしてimportすると、
 *   単一HTML構成のCapacitorプロジェクトでは読み込みに失敗することがあるため、
 *   window.Capacitor.Plugins.AdMob 経由で呼び出す。
 * - 列挙値は数値/オブジェクト定数ではなく文字列で渡す。
 * - ブラウザ確認時など、AdMobプラグインが存在しない環境では
 *   何もせず安全にスキップする（広告なしでもアプリ本体は通常動作する）。
 *
 * 同意処理（UMP）について：
 * - アプリ起動直後に独自判断でATT（App Tracking Transparency）ダイアログは表示しない。
 * - まずGoogle User Messaging Platform（UMP）で同意情報を取得し、
 *   必要な場合のみ同意フォームを表示したうえで、広告リクエスト可否（canRequestAds）を確認する。
 * - 初期版では常に非パーソナライズ広告（npa）をリクエストする方針とし、
 *   IDFA（広告識別子）によるトラッキングを行わないため、ATT許可要求は行わない。
 *   このため、AdMob SDKの`requestTrackingAuthorization()`は呼び出さない。
 *   将来パーソナライズ広告に対応する場合のみ、UMPの同意取得が完了した後、
 *   本当に必要な場合に限ってATTを要求すること（先にUMP、その後にATTの順序を守る）。
 * - 同意フォーム表示・広告表示のいずれに失敗しても、名前生成機能は通常どおり動作する。
 * - アプリを開くたびに（起動時に毎回）同意情報を取得し直し、
 *   プライバシー設定の再表示導線の要否も毎回判定し直す。
 */

(function (global) {
  "use strict";

  // ===== 広告ID設定 =====
  // 開発・テスト中は必ずこちらのGoogle公式テストIDを使う。
  const TEST_APP_ID = "ca-app-pub-3940256099942544~1458002511";
  const TEST_BANNER_UNIT_ID = "ca-app-pub-3940256099942544/2934735716";

  // 本番確認時のみ、下記の指定IDへ切り替える。
  const PRODUCTION_APP_ID = "ca-app-pub-8174756915786797~2259245053";
  const PRODUCTION_BANNER_UNIT_ID = "ca-app-pub-8174756915786797/8904544451";

  // 本番リリース準備が整うまでは必ずtrueのままにしておく。
  const USE_TEST_ADS = true;

  const BANNER_UNIT_ID = USE_TEST_ADS ? TEST_BANNER_UNIT_ID : PRODUCTION_BANNER_UNIT_ID;

  function getPlugin() {
    if (
      global.Capacitor &&
      global.Capacitor.Plugins &&
      global.Capacitor.Plugins.AdMob
    ) {
      return global.Capacitor.Plugins.AdMob;
    }
    return null;
  }

  /**
   * UMPで同意情報を取得し、必要な場合だけ同意フォームを表示する。
   * 最終的な同意情報（canRequestAds / privacyOptionsRequirementStatusを含む）を返す。
   */
  async function resolveConsent(AdMob) {
    // 開発中に同意フォームの表示自体を手元で確認したい場合は、
    // ここに一時的に debugGeography / testDeviceIdentifiers を指定してよい。
    // 本番ビルドには反映しないこと。
    const requestOptions = {};

    let consentInfo = await AdMob.requestConsentInfo(requestOptions);

    if (!consentInfo.canRequestAds && consentInfo.isConsentFormAvailable) {
      // UMP SDK自身に「必要な場合だけ表示」を判断させる。
      consentInfo = await AdMob.showConsentForm();
    }

    return consentInfo;
  }

  const AdManager = {
    _privacyOptionsRequired: false,
    _onPrivacyOptionsChange: null,
    _listenersRegistered: false,

    _setDiagnostic(message, isError) {
      if (!USE_TEST_ADS || !global.document) return;
      let node = global.document.getElementById("admob-diagnostic");
      if (!node) {
        node = global.document.createElement("div");
        node.id = "admob-diagnostic";
        node.style.cssText = [
          "position:fixed",
          "left:8px",
          "right:8px",
          "bottom:58px",
          "z-index:2147483647",
          "padding:8px 10px",
          "border-radius:8px",
          "font:12px/1.35 -apple-system,BlinkMacSystemFont,sans-serif",
          "color:#fff",
          "text-align:center",
          "pointer-events:none",
          "box-shadow:0 2px 8px rgba(0,0,0,.25)"
        ].join(";");
        global.document.body.appendChild(node);
      }
      node.style.background = isError ? "#B42318" : "#333333";
      node.textContent = "AdMob診断: " + message;
    },

    async _registerDiagnosticListeners(AdMob) {
      if (this._listenersRegistered || typeof AdMob.addListener !== "function") return;
      this._listenersRegistered = true;
      await AdMob.addListener("bannerAdLoaded", () => {
        console.info("[ads] banner loaded", {
          mode: USE_TEST_ADS ? "test" : "production",
          adUnitId: BANNER_UNIT_ID
        });
        this._setDiagnostic("テスト広告の読み込み成功", false);
      });
      await AdMob.addListener("bannerAdFailedToLoad", (error) => {
        console.error("[ads] banner failed to load", error);
        const detail = error && (error.message || error.code);
        this._setDiagnostic(
          "読み込み失敗" + (detail ? " / " + detail : ""),
          true
        );
      });
    },

    /**
     * 「プライバシー設定」ボタンの表示/非表示が変わったときに呼ばれるコールバックを登録する。
     * init()を呼ぶ前に登録しておくこと。
     * @param {(required: boolean) => void} callback
     */
    setOnPrivacyOptionsChange(callback) {
      this._onPrivacyOptionsChange = typeof callback === "function" ? callback : null;
    },

    /**
     * 現時点で「プライバシー設定」ボタンを表示すべきかどうか。
     */
    isPrivacyOptionsRequired() {
      return this._privacyOptionsRequired;
    },

    _updatePrivacyOptionsRequired(required) {
      this._privacyOptionsRequired = !!required;
      if (this._onPrivacyOptionsChange) {
        try {
          this._onPrivacyOptionsChange(this._privacyOptionsRequired);
        } catch (e) {
          console.warn("[ads] onPrivacyOptionsChange callback failed", e);
        }
      }
    },

    async init() {
      this._setDiagnostic("プラグインを確認中", false);
      const AdMob = getPlugin();
      if (!AdMob) {
        // ブラウザ確認時やプラグイン未導入時は、ボタンも非表示のまま安全にスキップする。
        this._updatePrivacyOptionsRequired(false);
        this._setDiagnostic("AdMobプラグイン未検出", true);
        return;
      }

      try {
        // capacitor-community/admob v8の推奨順序に合わせ、最初にSDKを初期化する。
        await AdMob.initialize({
          initializeForTesting: USE_TEST_ADS
        });
        this._setDiagnostic("SDK初期化済み / UMP確認中", false);
        await this._registerDiagnosticListeners(AdMob);

        const consentInfo = await resolveConsent(AdMob);

        console.info("[ads] consent resolved", {
          status: consentInfo && consentInfo.status,
          canRequestAds: !!(consentInfo && consentInfo.canRequestAds),
          privacyOptionsRequirementStatus:
            consentInfo && consentInfo.privacyOptionsRequirementStatus,
          mode: USE_TEST_ADS ? "test" : "production"
        });

        this._updatePrivacyOptionsRequired(
          !!consentInfo && consentInfo.privacyOptionsRequirementStatus === "REQUIRED"
        );

        this._setDiagnostic(
          "UMP=" + (consentInfo && consentInfo.status) +
            " / canRequestAds=" + !!(consentInfo && consentInfo.canRequestAds),
          false
        );

        if (!consentInfo || !consentInfo.canRequestAds) {
          if (!USE_TEST_ADS) {
            // 本番広告はUMPが許可する場合だけリクエストする。
            return;
          }
          // 診断ビルドではGoogle公式テスト広告まで処理を進め、
          // UMPとプラグイン／バナー経路のどちらが原因かを切り分ける。
          this._setDiagnostic("UMP未許可 / テスト広告で経路確認を続行", false);
        }

        await this.showBanner();
      } catch (e) {
        // 同意処理・広告初期化に失敗してもアプリ本体は通常動作させる。
        console.warn("[ads] AdMob consent/initialization failed", e);
        this._updatePrivacyOptionsRequired(false);
        this._setDiagnostic(
          "初期化またはUMP失敗 / " + (e && e.message ? e.message : String(e)),
          true
        );
      }
    },

    async showBanner() {
      const AdMob = getPlugin();
      if (!AdMob) return;

      try {
        console.info("[ads] requesting banner", {
          mode: USE_TEST_ADS ? "test" : "production",
          adUnitId: BANNER_UNIT_ID
        });
        this._setDiagnostic("Google公式テスト広告をリクエスト中", false);
        await AdMob.showBanner({
          adId: BANNER_UNIT_ID,
          adSize: USE_TEST_ADS ? "BANNER" : "ADAPTIVE_BANNER",
          position: "BOTTOM_CENTER",
          margin: 0,
          isTesting: USE_TEST_ADS,
          // 初期版はIDFAトラッキングを行わないため、常に非パーソナライズ広告を要求する。
          npa: true
        });
      } catch (e) {
        console.warn("[ads] showBanner failed", e);
        this._setDiagnostic(
          "showBanner呼び出し失敗 / " + (e && e.message ? e.message : String(e)),
          true
        );
      }
    },

    /**
     * UMPのプライバシー設定フォーム（同意の再変更用）を表示する。
     * @returns {Promise<{success: boolean}>}
     */
    async showPrivacyOptionsForm() {
      const AdMob = getPlugin();
      if (!AdMob) {
        return { success: false };
      }
      try {
        await AdMob.showPrivacyOptionsForm();
        return { success: true };
      } catch (e) {
        console.warn("[ads] showPrivacyOptionsForm failed", e);
        return { success: false };
      }
    }
  };

  global.NamaeGachaAds = AdManager;
})(window);
