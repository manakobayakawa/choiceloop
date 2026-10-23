# GitHubアップロード手順

1. このZIPを解凍します。中の ChoiceLoop フォルダがプロジェクト本体です。
2. GitHubで空のリポジトリを作成します。READMEや.gitignoreは同梱済みなので、作成時の自動追加は不要です。
3. 下記を実行します。URLは自分のリポジトリのものに置き換えてください。

```bash
cd ChoiceLoop
git init
git add .
git commit -m "Add ChoiceLoop hackathon application"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

ブラウザーからファイルを追加する場合も、解凍したZIPファイル自体ではなく、プロジェクトの中身をアップロードします。.openai、.gitignoreなどの隠しファイルも必要なため、Gitを使う方法が確実です。

READMEに公開デモURL、起動手順、テスト、技術構成、評価結果を記載しています。GitHubのAbout欄用の文章はGITHUB_ABOUT.txtにあります。

重要なデータ:

- 凍結済みS-ID 25ケースとベースライン・再測定の原本を保持しています。
- 現在の評価は Information sufficiency（7/25 → 7/25、差0）。顧客選択率ではありません。
- P-IDの24件案は別の提案データとして保持しています。
- APIキー、認証情報、node_modules、ビルド生成物、実行時DBは含めていません。
- このZIPはアプリのソースです。GitHubへ載せただけではアプリは公開実行されません。公開デモはREADMEの既存URLです。
- 起動・実装・テストの詳細はREADME.mdとdocs/を参照してください。

新しいライセンスは選択していません。既存の第三者ライセンス表記は含めています。
