# なまえガチャ（初期版）

`NamaeGacha_Claude_Implementation_Spec.md` を実装基準として作成した、iPhone専用アプリの初期版です。
HTML / CSS / JavaScript で実装し、Capacitorを使ってiOSアプリ化する構成になっています。

- `www/` 以下に機能別のファイル構成で分離しています。
- 正式データ22,000件（姓10,000件・名12,000件）を組み込み済みです。
- PCでの直接確認用に `name_data.js` も同梱しています。iPhone版はJSONを使用します。
- 広告はGoogle公式の**テスト広告ID**を使う設定になっています（`www/js/ads.js` 内 `USE_TEST_ADS = true`）。

---

## 1. フォルダ構成

```text
namaegacha/
├── www/                     ← アプリ本体（Web資産）
│   ├── index.html
│   ├── css/app.css
│   ├── js/
│   │   ├── app.js           画面遷移・イベント処理
│   │   ├── generator.js     3段階rarity抽選ロジック
│   │   ├── storage.js       条件・履歴・お気に入りの端末保存
│   │   └── ads.js           AdMobバナー（テストID使用）
│   ├── data/
│   │   ├── surnames.json    正式姓データ（10,000件）
│   │   ├── given_names.json 正式名データ（12,000件）
│   │   ├── name_data.js     PC直接確認用データ
│   │   └── data_sources.json
│   └── assets/
│       └── icon-placeholder.svg  仮アイコン案（本番アイコンは別途用意）
├── tools/
│   └── validate_name_data.js     データ検査スクリプト（Node実行）
├── capacitor.config.json
├── package.json
└── README.md
```

`ios/` フォルダはまだ含まれていません。後述の手順でCapacitorが自動生成します。

---

## 2. ブラウザで動作確認する（一番手軽な確認方法）

Xcodeがなくても、まずはPCのブラウザでロジックとUIを確認できます。

```bash
cd namaegacha/www
npx serve .
# もしくは: python3 -m http.server 8080
```

表示されたURL（例: `http://localhost:3000` や `http://localhost:8080`）をブラウザで開いてください。
広告SDK（AdMobプラグイン）が存在しない環境なので、広告枠は空のまま表示されますが、それ以外の機能はすべて確認できます。

ZIPを右クリックして「すべて展開」した後、`www/index.html`をダブルクリックする方法でも確認できます。
圧縮フォルダ内から直接開くとCSS等が一時フォルダへコピーされず、正しく表示されないため、必ず先に展開してください。
直接起動時は `www/data/name_data.js`、サーバー・iPhone環境ではJSONを使用します。

---

## 3. データ検査スクリプトを実行する

```bash
cd namaegacha
node tools/validate_name_data.js
```

JSON構文、ID重複、ID形式、漢字＋読みの重複、`rarity`／`categories`の値、
各性別条件・各rarityで候補が0件になっていないか、ひらがな以外の文字混入などを検査します。

正式な22,000件データに差し替えたときは、件数まで含めて厳密に検査できます。

```bash
node tools/validate_name_data.js --strict-counts
# 姓10,000件・名12,000件（male 5,000 / female 5,000 / neutral 2,000）を必須条件にする
```

### 3.1 生成ロジック（直前重複回避）の自動テスト

`generator.js`の「直前と同じ姓名を絶対に返さない」ロジックを検査するテストです。

```bash
node tools/test_generator.js
```

以下を確認しています。

- 組み合わせが実質1通りしかない条件で、直前と同じ結果になりうる場合は、結果を返さず専用エラー（`ONLY_DUPLICATE_AVAILABLE`）になること
- 姓または名のどちらかしか候補が無くても、複数組み合わせが存在する限り必ず直前と異なる結果になること
- 初回生成（直前の結果が無い状態）はエラーにならないこと
- 実際のサンプルデータで各生成条件ごとに5,000回生成しても、直前との重複が一度も発生しないこと

---

## 4. Capacitorでネイティブプロジェクトを作る

### 4.1 依存パッケージのインストール

```bash
cd namaegacha
npm install
```

### 4.2 bundle IDの確認（重要）

`capacitor.config.json` の `appId` は仮の値 `com.example.namaegacha` です。
**iOSプロジェクトを作る前に**、実際に使うbundle ID（例: `com.yourcompany.namaegacha`）に書き換えてください。
`cap add ios` の後で `appId` を変えると手直しが増えるため、先に決めておくのがおすすめです。

### 4.3 iOSプロジェクトの追加

```bash
npx cap add ios
npx cap sync ios
```

> **ご利用の開発環境について**
> Capacitorの `ios/` プロジェクトを開いてビルドするには、実際にはXcode（＝Mac環境）が必要です。
> Windows環境から直接Xcodeビルドはできないため、以下のいずれかで対応してください。
> - **Codemagic**（`mac_mini_m2`）などのクラウドMac CI/CDサービスにリポジトリを接続してビルド
> - 一時的に借りられるクラウドMac、または知人・共有のMac環境でXcodeを開く
>
> `npx cap add ios` 自体はWindows上でも実行できます（`ios/` フォルダの生成のみ）。
> 実際のビルド・実機インストール・App Store Connectへのアップロードの工程でMac相当の環境が必要になります。

### 4.4 iOS側で追加設定が必要な項目

`ios/` プロジェクト生成後、Xcode（またはCI設定）側で以下を確認してください。

- **画面向きの固定**：`Info.plist` の `UISupportedInterfaceOrientations` を縦向きのみにする
- **AdMob**：`Info.plist` に以下を追加
  - `GADApplicationIdentifier`（開発中はテスト用アプリID `ca-app-pub-3940256099942544~1458002511`、本番時は仕様書記載の `ca-app-pub-8174756915786797~2259245053`）
  - `NSUserTrackingUsageDescription` は**追加しない**：この初期版は`requestTrackingAuthorization()`を呼び出さず、ATT（App Tracking Transparency）のダイアログを一切表示しない。常に非パーソナライズ広告のみをリクエストするため、ATT許可自体が不要。
  - **AppTrackingTransparencyフレームワークも追加しない**（ATTを使わないため）。
  - 将来、実際にATT（IDFAを使ったパーソナライズ広告など）を導入する場合のみ、公式要件に従って`NSUserTrackingUsageDescription`とAppTrackingTransparencyフレームワークの両方を追加し、UMPの同意取得が完了した後に`requestTrackingAuthorization()`を呼び出すよう実装を変更すること。
  - 同意（UMP）まわりはコード側（`www/js/ads.js`）で処理するため、Info.plistへの追加設定は不要です。
- **`@capacitor-community/admob` プラグイン**：`npx cap sync ios` 実行後、Podが正しくインストールされていることを確認
- カメラ・写真・位置情報・連絡先・通知などの権限リクエストは追加していません（仕様通り不要）

---

## 5. AdMobの同意処理と本番IDへの切り替え

`www/js/ads.js` はアプリ起動時に、まずGoogle User Messaging Platform（UMP）で同意情報を取得し
（`requestConsentInfo`）、同意フォームが必要な場合のみ表示します（`showConsentForm`）。
広告リクエスト可否（`canRequestAds`）が確認できた場合のみAdMobを初期化し、バナーを表示します。

- アプリ起動直後に独自判断でATT（App Tracking Transparency）ダイアログを表示することはありません。
  `requestTrackingAuthorization()` は呼び出していません。
- バナー広告は常に非パーソナライズ広告（`npa: true`）としてリクエストするため、IDFAによるトラッキングを行わず、
  ATT許可が無くても広告を表示できます。
- 同意情報の取得・同意フォーム表示・広告初期化のいずれかに失敗しても、例外は`ads.js`内で握りつぶし、
  名前生成など他の機能には影響しません。
- ブラウザでの確認時（AdMobプラグイン未導入）は、これらの処理はすべて安全にスキップされます。
- アプリを開くたびに（毎回の起動時に）同意情報を取得し直すため、地域や同意状況の変化にも追従します。

### 5.1 「プライバシー設定」ボタン（UMPの再表示導線）

Google公式仕様では、`privacyOptionsRequirementStatus`が`REQUIRED`の場合、ユーザーが後から同意内容を
確認・変更できる導線が必要です。この初期版では、ホーム画面の情報ポップアップ内に「プライバシー設定」
ボタンを用意し、次のように動作します。

- `ads.js`が起動時（毎回）に`requestConsentInfo()`の結果から`privacyOptionsRequirementStatus`を判定し、
  `REQUIRED`のときだけボタンを表示、それ以外（`NOT_REQUIRED` / `UNKNOWN`）では非表示にします。
- ボタンをタップすると`AdMob.showPrivacyOptionsForm()`を呼び出し、UMPの設定フォームを表示します。
- フォーム表示に失敗した場合は、画面下部に短いトースト（「プライバシー設定を開けませんでした」）を
  表示するだけで、アプリは通常どおり動作を続けます。
- ブラウザ確認時（AdMobプラグイン未導入）はボタンは常に非表示になります。

**動作確認方法**：日本国内の実機・シミュレータでは通常`privacyOptionsRequirementStatus`が
`REQUIRED`にならずボタンは表示されません。表示条件を手元で確認したい場合は、`ads.js`の
`resolveConsent()`内にある`requestOptions`に、開発中のみ一時的に
`debugGeography: 1`（`AdmobConsentDebugGeography.EEA`相当の値）と、実機のテストデバイスIDを
`testDeviceIdentifiers`に指定してビルドし、EEA地域向けの同意フローを強制してください。
確認が終わったら必ず元（空のオブジェクト）に戻し、本番ビルドには反映しないでください。

広告IDの切り替えは、これまでどおり先頭の定数だけで管理しています。

```js
const USE_TEST_ADS = true; // 実機での最終確認が終わるまでtrueのまま
```

実機での動作確認がすべて完了し、本番広告表示を確認する段階になったら `false` に変更してください。
テストIDと本番IDの両方の定数は既にファイル内に記載済みです。

---

## 6. 正式な姓名データへの差し替え方法

正式データを組み込み済みです。

- 姓：10,000件
- 名：12,000件（男性5,000件、女性5,000件、性別未分類2,000件）
- 中性的フィルター対象：80件（上記12,000件内の複数分類）
- 同じ表記でも読みが異なる場合は別データとして扱う
- `primaryCategory=unspecified` は「中性的」を意味しない

JMnedictの品詞分類を基礎にし、KANJIDIC2の音読み・訓読み・名乗りとの分割照合、文字種、長さ、
重複、使用漢字等の機械検査を通しています。中性的分類は読みだけでは判定せず、表記と読みの組を
保守的に選定しています。`rarity`は人口統計上の順位ではなく、アプリ内抽選用の相対的な指標です。

再生成する場合は、同版のJMnedict JSONとKANJIDIC2 JSONを用意し、次を実行します。

```bash
python3 tools/build_name_data.py <JMnedict JSON> <KANJIDIC2 JSON> www/data \
  --surname-frequency <姓・順位・件数CSV>
node tools/validate_name_data.js --strict-counts
node tools/test_generator.js
```

データの出典・ライセンス・取得版は `DATA_NOTICE.md` と `www/data/data_sources.json` を参照してください。
再生成時には、PC直接確認用の `www/data/name_data.js` も同時に更新されます。

置き換え後は、ホーム画面の情報ポップアップ等で収録数（22,000件）の文言を表示する場合、
サンプル段階では表示しない設計になっている点を確認してください（現状のポップアップ文言には収録数を含めていません）。

---

## 7. 実機確認チェックリスト

仕様書20章の完了条件に対応する確認項目です。

- [ ] 縦向き固定で、ホーム／結果／履歴・お気に入りの3画面を操作できる
- [ ] 生成条件「すべて／男性／女性／中性的」がそれぞれ正しく候補を絞り込む
- [ ] 同じ条件で何度も生成しても、直前と全く同じ姓名が連続しない
- [ ] 複数カテゴリー所属の名（例：`光`＝`ひかる`）が重複候補にならず、条件をまたいで自然に出現する
- [ ] 履歴が新しい順で最大100件、101件目追加時に最古の1件が消える
- [ ] 「履歴をすべて削除」に確認ダイアログが出て、お気に入りには影響しない
- [ ] お気に入りの登録・解除・重複登録防止が機能する
- [ ] コピー機能で「姓 名」（半角スペース区切り、漢字のみ）がクリップボードに入り、完了トーストが出る
- [ ] アプリを再起動しても、選択していた生成条件・履歴・お気に入りが復元される
- [ ] 履歴・お気に入り一覧から名前を開いても、新しい履歴として増えない
- [ ] 機内モードなどでJSON読み込みに失敗しても、エラー表示のみでアプリが停止しない
- [ ] 選択した条件に合う名が0件のケースで、勝手に条件を変えずエラー表示になる（サンプルデータでは全条件に候補があるため、確認する場合は一時的にデータを空にするなどして検証）
- [ ] 直前と同じ姓名が正常終了時に返らないこと（`node tools/test_generator.js`で自動検査済み。組み合わせが実質1通りしかない場合は専用エラーメッセージが表示される）
- [ ] 初回のAdMob表示時、アプリが独自にATTダイアログを出さないこと（UMPの同意フローのみが動作し、広告は常に非パーソナライズとしてリクエストされる）
- [ ] `privacyOptionsRequirementStatus`が`REQUIRED`でない通常の状態では、情報ポップアップ内に「プライバシー設定」ボタンが表示されないこと
- [ ] （EEA地域を模したデバッグ設定などで）`REQUIRED`になる状況を再現した場合、ボタンが表示され、タップでプライバシー設定フォームが開くこと。表示に失敗してもアプリが止まらずトーストだけ出ること
- [ ] AdMobがテストバナーとして表示され、広告読み込み失敗時も名前生成には影響しない
- [ ] 画面下部の広告枠とボタンの間に誤タップを防ぐ余白がある
- [ ] 仕様書18章で明示的に除外された機能（共有、意味・由来表示、姓名判断、個別コピー等）が入っていない

---

## 8. 今回の実装範囲外（別工程）

- 正式なApp Storeアイコン画像一式（`www/assets/icon-placeholder.svg` はデザイン方針の参考案）
- プライバシーポリシーの実URL（`app.js` 内 `PRIVACY_POLICY_URL` を差し替える）
- Xcodeでのビルド・署名・App Store Connectへのアップロード
