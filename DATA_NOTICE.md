# 姓名データの出典と取扱い

このアプリの `www/data/surnames.json` と `www/data/given_names.json` は、Electronic Dictionary
Research and Development Group（EDRDG）の辞書データを加工して作成しています。

## 使用データ

- JMnedict（jmdict-simplified JSON、辞書日付 2026-08-24、変換版 3.6.2）
- KANJIDIC2（jmdict-simplified JSON、辞書日付 2026-08-24、データベース版 2026-236）
- 「日本の姓の人口順のデータ」（城岡啓二、静岡大学学術リポジトリ、2018-08-10）

JMnedictは姓名候補と性別タグの抽出に、KANJIDIC2は表記と読みの機械照合および使用漢字の
絞り込みに使用しました。配布ZIPには元の辞書ファイル自体は含めていません。
姓の一般性を優先するため、静岡大学のデータは姓表記の選択順にのみ使用しています。元CSVは配布ZIPに含めません。

- https://shizuoka.repo.nii.ac.jp/records/10691

## ライセンス

元データにはEDRDGのライセンス条件が適用されます。公開・配布前に必ず最新版の条件を確認し、
アプリ内または配布物内に必要な帰属表示を維持してください。

- EDRDGライセンス: https://www.edrdg.org/edrdg/licence.html
- JMnedict: https://www.edrdg.org/enamdict/enamdict_doc.html
- KANJIDICプロジェクト: https://www.edrdg.org/wiki/index.php/KANJIDIC_Project
- JSON変換プロジェクト: https://github.com/scriptin/jmdict-simplified

## 入力アーカイブの検証値（SHA-256）

- `jmnedict-all-3.6.2+20260824122934.json.tgz`:
  `c5c4b19a715c514f8a7d3243490e38118fbac4845d3114123aade6dfe8bac5f0`
- `kanjidic2-all-3.6.2+20260824122934.json.tgz`:
  `e0ea8713190ad7a4407949d93e68fa29f8dfd49c604fffef4ecca8ea19f2fc89`

## 注意

辞書収録と機械検査は、現代日本での使用頻度や個々の名の適切性を保証するものではありません。
リリース前には、特に `rare` 区分について追加の人手確認を推奨します。
