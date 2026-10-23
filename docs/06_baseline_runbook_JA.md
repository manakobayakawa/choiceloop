# ChoiceLoop — 改善前の測定手順

## 今すぐ行うこと
プラグイン完成を待たず、下の3問を各2回、計6件測定する。1問・1回ごとに別のチャットを使う。これは動作確認用の小さなパイロットであり、100人の顧客や地域市場の代表調査ではない。

1. このプロジェクトの外で新しいTemporary chatを開き、送信前にUnpersonalizedを明示的に選択する。ChoiceLoop、PDF、店舗名を説明する追加指示、他のプラグイン、先の回答を添付しない。
2. Web Searchを有効にする。表示されているモデル名、日時とタイムゾーン、検索使用の有無、設定を記録する。不明はnullにし、理由を残す。
3. 下の質問だけをそのまま送る。追加で「5店」「順位付き」「Café Athenaも考慮」等を付けない。文言を変えるなら新しい実験バージョンにする。
4. 回答全文、引用元URL、スクリーンショットを保存する。temporary chatは保存しなければ後から履歴で開けないので、退出前に必ず保存する。
5. 03_live_run_template.jsonを1実行1レコードで埋める。raw_responseは改変せず貼る。店舗リストへの構造化は別途行い、人間が照合する。
6. 04_live_observations.jsonのobservations配列に追記する。失敗や検索不使用も捨てずにstatusと理由を残す。

## 最初の3問

### P001 — Pacific Beach resident / Greek dinner / Budget-conscious

```text
I live in Pacific Beach. Where would you recommend a Greek or Mediterranean restaurant for dinner in Pacific Beach, ideally around $25–30 per person?
```

### P050 — Weekend traveler / Date night / Atmosphere-sensitive

```text
I am visiting San Diego for the weekend. What are a few good options for a date-night restaurant with Mediterranean food and cocktails in Pacific Beach, San Diego, somewhere suitable for a relaxed conversation?
```

### P075 — Family traveler / Dietary options / Booking-oriented

```text
My family is visiting San Diego. I am a family visiting San Diego. Any suggestions for a Mediterranean restaurant with vegetarian and gluten-free options in Pacific Beach, San Diego, and I would prefer an online reservation option?
```

## 結果の読み方
- 検索言及率：Café Athenaの名前を含む回答数 / 実行成功・全文保存・Web検索利用確認済み回答数。未実行・失敗を「店が出なかった」と数えない。
- 推薦率：Café Athenaを肯定的な候補として推薦した回答数 / 同条件の有効回答数。単なる言及・除外例との違いを保つ。
- 順位：明示的な優先順位付けだけをpreference rankとする。表示順はdisplay positionとして別に記録する。単に「1、2、3」と列挙されただけで選好順位と決めつけない。
- 繰り返しは顧客数ではない。「3質問×2回、6回答」と表示し、質問ごとのばらつきも残す。
- 該当データなしはN/AまたはNot measured。0%は有効な実測分母がある場合だけ。
- 対象地域は質問文で指定しているが、実行者のIP地域などを完全には固定できない。ローカル住民の実検索と同等だとは主張しない。

## 最初の6件の後
新計画のdevelopment 12件を使って診断・改善を進める。validation_holdout 12件は改善案と判定基準を固定するまで改善エージェントへ渡さない。最後に同じ検証シナリオを旧コンテンツ・改善案の両方で評価する。この24件は設計上の網羅性を重視した仮想テストであり、統計的な母集団代表性を持たない。

## 公式操作情報（2026-10-23確認）
- https://help.openai.com/en/articles/8914046-temporary-chat-in-chatgpt
- https://help.openai.com/en/articles/9237897-searching-the-web-with-chatgpt

OpenAIの説明では、Unpersonalized temporary chatはmemory、custom instructions、pluginsを使わない。検索は地域・設定の影響を受け得る。画面で選択肢を確認できない場合は「隔離を確認できなかった」と記録し、clean baselineと偽らない。
