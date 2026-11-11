# なまえガチャ 1.1.0

iPhone専用のランダム姓名メーカーです。HTML/CSS/JavaScriptとCapacitorで構成し、
WindowsからCodemagicを使用してApp Store向けにビルドします。

## 1.1.0の主な変更

- 日本名データを姓20,000件・名20,000件へ増量
- 漢字表記だけで姓名を検索
- 「自分の名前は何回目？」チャレンジと端末内ベスト記録
- 未登録名の外部フォームへの追加リクエスト
- 重複なしの10連ガチャ
- 通常・10連・チャレンジ結果の1200×1200画像共有
- 既存履歴・お気に入りを保持する保存形式移行
- 高コントラストの和モダンUI
- 既存のAdMob／UMP／非パーソナライズ広告方針を維持

## 主要構成

```text
www/
├─ index.html
├─ css/app.css
├─ js/
│  ├─ app.js
│  ├─ generator.js
│  ├─ storage.js
│  ├─ share.js
│  └─ ads.js
└─ data/
   ├─ manifest.json
   ├─ surnames.json
   ├─ given_names.json
   ├─ name_data.js
   └─ data_sources.json

docs/
├─ index.html
├─ privacy.html
└─ support.html

tools/
├─ build_name_data.py
├─ validate_name_data.js
├─ test_generator.js
├─ test_priority_surnames.js
└─ test_v110.js
```

## ブラウザ確認

ZIPを展開し、プロジェクト直下で実行します。

```bash
npx serve www
```

または、

```bash
cd www
python3 -m http.server 8080
```

`www/index.html`の直接起動にも対応しています。直接起動時は、JSONの取得に失敗した場合のみ
`name_data.js`を読み込みます。広告とネイティブ共有シートはブラウザでは使用されません。

## 検査

```bash
npm run validate-data:strict
npm run test:generator
npm run test:priority-surnames
npm run test:v110
```

厳密検査では以下を必須とします。

- 姓20,000件
- 名20,000件
- 男性主分類8,000件
- 女性主分類8,000件
- 性別未分類4,000件
- ID、表記＋読み、カテゴリー、内部レア度の整合性

## 姓名データ再生成

同じ版のJMnedict JSONとKANJIDIC2 JSONを展開し、現在の公開データを基礎として実行します。

```bash
python3 tools/build_name_data.py JMnedict.json KANJIDIC2.json www/data \
  --base-surnames www/data/surnames.json \
  --base-given-names www/data/given_names.json
```

人口順CSVが利用できる場合は`--surname-frequency CSV_PATH`も指定できます。
既存データを先に維持し、不足分だけ追加するため、公開済みの名前が増量によって脱落しません。

## 外部リンク設定

`www/js/app.js`先頭付近に以下を設定済みです。

- App Store公開ページ
- 名前追加リクエスト用Googleフォーム
- 「名前の種類」と「漢字表記」の事前入力項目ID

Googleフォームは以下を確認します。

- メールアドレスを収集しない
- Googleログインを必須にしない
- 姓／名、表記、読みを入力できる
- 個人情報を入力しない旨を表示する

## iOSと共有プラグイン

1.1.0では以下を使用します。

- `@capacitor-community/admob`
- `@capacitor/browser`
- `@capacitor/share`
- `@capacitor/filesystem`

依存関係をインストールし、iOSへ同期します。

```bash
npm install
npx cap sync ios
```

## Codemagic

`codemagic.yaml`の`APP_VERSION`は`1.1.0`です。
ビルド番号はCodemagicの`PROJECT_BUILD_NUMBER`を使用します。

`ADMOB_USE_PRODUCTION: "true"`の場合、ビルド時に`ads.js`を本番広告モードへ切り替えます。
ソースではGoogle公式テスト広告を既定値として維持します。

## AdMob・UMP

- 本番AdMobアプリIDとバナーIDは既存設定を維持
- UMP確認後に広告をリクエスト
- バナーは非パーソナライズ広告
- ATTを呼び出さない
- UMPまたは広告が失敗してもアプリ機能を止めない
- プライバシー設定が必要な場合だけ情報画面に再表示ボタンを出す

## 保存データの移行

1.0.1の以下のデータを1.1.0初回起動時に保持して移行します。

- 選択カテゴリー
- 履歴
- お気に入り

チャレンジのベスト記録は1.1.0から追加されます。履歴は最大100件相当で、
10連結果は10件を1グループとして保存します。

## 提出前確認

- GoogleフォームとApp Store URLが開けることを確認
- `docs/privacy.html`と`docs/support.html`を公開先へ反映
- TestFlightで1.0.1から上書き更新
- 履歴とお気に入りが残ることを確認
- 共有画像、10連、検索、チャレンジを実機確認
- テスト広告で共有プラグインを含むビルドを確認後、本番広告で最終ビルド
- 本番版にAdMob診断表示が出ないことを確認

姓名データの出典とライセンスは`DATA_NOTICE.md`を参照してください。

