# 認証メールの無料導入構成

2026-09-10 JST。構成判断はAstra、アプリ・テンプレートの実装はCursor CLI / Composer 2.5。

## 最新結果（2026-09-10 10:25 JST）

**メール認証とブラウザの基本引き継ぎは合格。** Cursorで自己競合、取得結果の適用、同期中の編集保持を修正。専用領域A（127.0.0.1:5188）で赤いチューリップを配置し、独立した領域B（localhost:5188）へ同一アカウントで実メール認証。写真・花・明示的な観察リンクが復元され、Bの再読み込み後も花のキーボード操作から同じ写真を開けた。A/Bの画像src一致も確認。

クラウドの読み取りでrevision 3・観察1件・花1本・red・tulip・観察リンク一致を確認。検証データ名は「引き継ぎ確認 9/10」、識別元は明示されたサンプル。実識別の検証とは区別する。検証用データは本人アカウントに残している。既存5186とiOS/Androidの保存データはこの試験で使用していない。

回帰試験38/38・Webビルド成功（Cursor実行）。今回の修正を含むネイティブ再ビルドと実端末間引き継ぎ、異なる受信アカウントによる切替・削除の実メール試験は未完了。通常プレビュー・ネイティブ向けに認証準備フラグを一括変更していない。

### 10:10時点までの設定・発見

本人が現在のGmailの使用と専用パスワードのSupabase保存を了承し、Googleの本人確認を完了。専用パスワードを作成してSMTPへ保存した。キーは会話本文・repo・ファイルへ記載していない。

- SMTP接続、Confirm sign upとMagic link or OTPの日本語本文を設定済み。
- 10:05に実メールが受信トレイへ到達。From・件名・日本語本文を確認し、郵便住所の挿入なし。Receivedヘッダーは対象SupabaseからGmailへのTLS接続。
- 既定OTPの8桁をアプリに合わせて6桁へ変更。10:07の再送メールで実ログイン成功。
- 専用領域127.0.0.1:5188と独立したlocalhost:5188の両方で、同一アカウントの実メール認証・同期済み表示を確認。
- 保存時の自己競合を検出し、Cursorで同期処理を修正中。メール成功を自動引き継ぎ全体の合格とは扱わない。

以下の未設定・了承待ちの記述は設定前の経緯。現在の判定は上記を優先する。

## 設定前の決定と候補

ユーザー指定は **初期費用0円、メールへ載せる住所を用意しない**。ドメイン購入は承認されておらず実行しない。住所登録が必要なBrevoの手続きを途中で止め、Gmail SMTPで初期の少人数検証を行う候補へ変更した。自動引き継ぎは初回リリース必須のまま。

| 役割 | 構成 | 状態 |
|---|---|---|
| 認証・DB・写真保存 | 既存Supabase専用プロジェクト | Freeを維持、追加プロジェクト不要 |
| 認証コード配信 | 本人所有の無料Gmail SMTP | 指定アカウントでアプリパスワード発行画面が利用可能。発行・保存前に利用アカウントを確認 |
| Web/API | 既存環境を継続 | 今回のための移設なし |
| Cloudflare / Brevo | 現行候補から外す | 購入・住所登録・SMTP設定・メール送信なし |

GoogleのSMTPは `smtp.gmail.com`。Supabaseも公式にGoogle SMTPとの接続方法を掲載している。ただしその検証例はWorkspaceであり、この個人Gmailアカウントでの成功は実送受信まで未証明。[Google設定](https://support.google.com/mail/answer/7104828?hl=en)、[Supabase接続例](https://supabase.com/docs/guides/troubleshooting/using-google-smtp-with-supabase-custom-smtp-ZZzU4Y)。

## アカウントと資格情報

2026-09-10の追加確認：ユーザーが「今のでやってみて」と回答し、説明済みの現在のGmailとアプリパスワードのSupabase保存を了承した。別アカウントの選択は不要。SMTPの非秘密項目を再入力したが、Googleがパスキーによる再本人確認を要求しているため本人操作を待つ。キーの作成・SMTP保存・実送信は未完了。

アプリパスワードは2段階認証を有効にしたGoogleアカウントで利用できる。通常のGoogleパスワードをSupabaseへ入れない。現在の指定Gmailでは作成画面を確認できたが、作成していない。[公式条件](https://support.google.com/accounts/answer/185833?hl=en)。

アプリパスワードはSMTP送信専用に権限を絞ったキーではない。Googleはアカウントアクセス用資格情報と説明し、外部メールクライアントでの利用も案内している。既存の送信元アドレス利用の了承を、資格情報を第三者サーバーへ保存する了承と取り違えない。現在のGmailで試験するか、送信用の別Gmailを用意するかを確認してから発行・保存する。[Googleの説明](https://support.google.com/mail/answer/7126229?hl=en)。

SupabaseのフォームではSMTP資格情報を暗号化して保存すると表示される。キーは会話・repo・フロント・検証ログに記録せず、安全な設定画面で扱う。不要になればGoogleの一覧から当該キーだけ削除でき、Google本体のパスワード変更でも失効する。

## 設定内容

| 項目 | 設定 |
|---|---|
| Sender email / Username | 利用を決定した本人所有のGmailアドレス。文書に個人アドレスを複製しない |
| Sender name | こもれび植物園 |
| Host | `smtp.gmail.com` |
| Port | `465`（SSL/TLS） |
| Minimum interval per user | `60`秒 |
| Password | この接続のために発行するGoogleアプリパスワード |
| 件名 | こもれび植物園の確認コード |
| 本文 | `supabase/templates/auth-code.html` |

Supabaseフォームの非秘密項目は準備中。**Save changesは押しておらず、サーバー側SMTP設定は未変更**。Googleキー未発行、実メール未送信。

既存アプリの `signInWithOtp({options:{shouldCreateUser:true}})` と `verifyOtp({type:'email'})` を維持する。Magic Linkテンプレートへ `{{ .Token }}` を含むHTMLを設定し、OTP桁数を既存画面の6桁と一致させる。[公式OTP手順](https://supabase.com/docs/guides/auth/auth-email-passwordless)。

新しいFreeプロジェクトは既定SMTPでテンプレート編集が制限され、custom SMTP導入で編集可能になる。[変更履歴](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier)。既定SMTPのチーム宛先限定・2通/時を一般公開の完成状態にはしない。[SMTP条件](https://supabase.com/docs/guides/auth/auth-smtp)。

## 少人数試験の範囲と受け入れ

Gmailは500通/日超などで制限され、再開まで1〜24時間かかる場合がある。500通を保証容量とは扱わず、初期の少量試験に限定する。Supabaseにも個人用SMTPでは到達性に影響し得るとの注意表示がある。無料SMTPで一般公開の継続運用まで保証できるとは説明しない。[Google上限](https://support.google.com/mail/answer/22839?hl=en)。

1. 利用アカウントと資格情報の保存を確認し、SMTPキーを発行・Supabaseへ設定する。
2. Magic LinkのToken本文と6桁設定を確認。新規・既存ログインの実メール到達を確認する。住所の自動挿入がないこと、From、迷惑メール判定、到達時間も実メールで確認する。
3. 検証領域だけ `VITE_AUTH_EMAIL_READY=true` とし、入力・再送・宛先変更・失敗からの復帰を確認する。通常プレビューは準備できるまでfalse。
4. [自動引き継ぎの受け入れ](release-external-acceptance.md)に従い、専用領域A/Bで実データ復元・アカウント分離・削除後非復活を確認。全項目には第2の受信可能な試験アカウントも必要。

一般公開前には送信容量、到達性、アカウント停止時の対応を別途判定する。課金を自動的な次工程にしない。

## 経緯

- ResendとCloudflare有料ドメインの案は、ユーザーの0円指定により取り下げ。購入なし。
- BrevoはGoogle基本情報連携まで行い、本人が英字氏名を入力。次の画面で住所が必須となり「送信メールに含まれる」と表示。ユーザーが住所を載せない別の無料方法を選んだため中止。住所は入力せずタブを閉じた。アカウント削除やGoogle連携の解除は行っていない。
- 確認コードHTMLはCursor / Composer 2.5作成・静的レビュー済み。新しい配信候補にも再利用する。
