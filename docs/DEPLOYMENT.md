# imgstk Deployment Guide

このドキュメントでは、imgstkをCloudflareにデプロイする手順を説明します。

## 前提条件

- [x] Cloudflareアカウント作成済み (belong2jazz@gmail.com)
- [x] R2バケット作成済み (imgstk-bucket)
- [x] D1データベース作成済み (imgstk-db)
- [x] マイグレーション実行済み
- [ ] Wrangler CLIでログイン済み

## Step 1: Wranglerログイン

```bash
npx wrangler login
```

ブラウザが開き、Cloudflareアカウントへのログインが求められます。
`belong2jazz@gmail.com` でログインしてください。

## Step 2: Worker（CDN配信）のデプロイ

### 2.1 Workerをデプロイ

```bash
cd d:/github/imgstk
npx wrangler deploy --config worker/wrangler.toml
```

成功すると、以下のようなURLが表示されます：
```
https://imgstk-worker.YOUR_SUBDOMAIN.workers.dev
```

### 2.2 動作確認

```bash
curl https://imgstk-worker.YOUR_SUBDOMAIN.workers.dev/healthz
```

`OK` が返ってくればOK。

### 2.3 カスタムドメイン設定

1. Cloudflare Dashboardにアクセス
2. Workers & Pages → imgstk-worker → Settings → Domains & Routes
3. Custom Domains → Add Custom Domain
4. `stk.be2nd.com` を入力
5. DNS設定が自動で追加される

## Step 3: Pages（管理画面+API）のデプロイ

### 3.1 Pagesプロジェクト作成 & デプロイ

```bash
cd d:/github/imgstk
npx wrangler pages deploy public --project-name=imgstk-pages
```

初回デプロイ時、以下が自動で設定されます：
- プロジェクト名: `imgstk-pages`
- ビルド出力ディレクトリ: `public/`

成功すると、以下のようなURLが表示されます：
```
https://imgstk-pages.pages.dev
```

### 3.2 環境変数とバインディングの設定

Cloudflare Dashboardで設定が必要です（Wrangler CLIでは一部設定できないため）。

1. Workers & Pages → imgstk-pages → Settings → Environment variables
2. 以下の環境変数を追加（Production環境）:

| Variable | Value |
|----------|-------|
| BASIC_AUTH_USER | mn |
| BASIC_AUTH_PASS | 39 |

3. Settings → Functions → R2 bucket bindings を追加:

| Binding Name | Bucket Name |
|--------------|-------------|
| R2_BUCKET | imgstk-bucket |

4. Settings → Functions → D1 database bindings を追加:

| Binding Name | Database |
|--------------|----------|
| DB | imgstk-db |

### 3.3 カスタムドメイン設定

1. Workers & Pages → imgstk-pages → Custom domains
2. Add a domain → `admin-stk.be2nd.com`
3. DNS設定が自動で追加される

## Step 4: 動作確認

### 4.1 CDN配信（Worker）

テスト画像をR2にアップロード:
```bash
echo "test" > test.txt
npx wrangler r2 object put imgstk-bucket/00000001.webp --file=test.txt
```

アクセステスト:
```bash
curl https://stk.be2nd.com/00000001.webp
```

### 4.2 管理画面（Pages）

ブラウザで以下にアクセス:
```
https://admin-stk.be2nd.com
```

Basic認証が表示されるはずです:
- Username: `mn`
- Password: `39`

ログイン後、アップロード画面が表示されればOK！

### 4.3 API動作確認

```bash
curl -u mn:39 https://admin-stk.be2nd.com/api/health
```

レスポンス:
```json
{"status":"ok","service":"imgstk-api"}
```

## Step 5: 初回動作テスト

### 5.1 テスト画像のアップロード

1. `https://admin-stk.be2nd.com` にアクセス
2. Basic認証でログイン (mn / 39)
3. バッチタイトル: "Test Upload 2025-11-21"
4. 2〜3枚の画像をドラッグ&ドロップ
5. 「アップロード開始」をクリック

### 5.2 Markdown生成テスト

1. 「バッチ一覧」をクリック
2. "Test Upload" バッチの「Markdown生成」をクリック
3. Markdownがモーダルに表示される
4. 「クリップボードにコピー」をクリック
5. テキストエディタに貼り付けて確認

### 5.3 CDN配信確認

生成されたMarkdownのURLをブラウザで開く:
```
https://stk.be2nd.com/00000001.webp
```

画像が表示されればOK！

### 5.4 削除テスト

1. 「バッチ一覧」でテストバッチの削除ボタンをクリック
2. 確認ダイアログで「OK」
3. バッチが一覧から消える
4. R2からも削除されたことを確認:
```bash
npx wrangler r2 object get imgstk-bucket/00000001.webp
# → Not Found エラーが出ればOK
```

## トラブルシューティング

### Worker デプロイエラー

**エラー**: `Error: Could not find R2 bucket`

**解決**:
```bash
# R2バケットの存在確認
npx wrangler r2 bucket list

# imgstk-bucket がなければ作成
npx wrangler r2 bucket create imgstk-bucket
```

### Pages Functions エラー

**エラー**: `DB is not defined`

**解決**: Cloudflare Dashboardで D1 binding を設定し忘れている可能性があります。
Step 3.2を再確認してください。

### Basic認証が動作しない

**エラー**: 何度入力しても認証エラー

**解決**: 環境変数が設定されていない可能性があります。
Cloudflare Dashboard → imgstk-pages → Settings → Environment variables を確認。

### CORS エラー

**エラー**: ブラウザコンソールに CORS エラー

**解決**: Worker の `ALLOWED_ORIGINS` にアクセス元ドメインを追加。
```toml
# worker/wrangler.toml
[vars]
ALLOWED_ORIGINS = "https://admin-stk.be2nd.com,http://localhost:8788"
```

## 本番運用チェックリスト

- [ ] Worker が `stk.be2nd.com` で動作
- [ ] Pages が `admin-stk.be2nd.com` で動作
- [ ] Basic認証が有効
- [ ] R2バケットへのアクセス確認
- [ ] D1データベースへのアクセス確認
- [ ] アップロード機能のテスト
- [ ] Markdown生成機能のテスト
- [ ] 削除機能のテスト
- [ ] CDN配信の速度確認（<100ms）

## 更新デプロイ

### Worker更新

```bash
cd d:/github/imgstk
npx wrangler deploy --config worker/wrangler.toml
```

### Pages更新

```bash
cd d:/github/imgstk
npx wrangler pages deploy public --project-name=imgstk-pages
```

### データベーススキーマ更新

新しいマイグレーションファイルを作成して実行:
```bash
npx wrangler d1 execute imgstk-db --remote --file=db/migrations/0002_new_feature.sql
```

## モニタリング

### Worker ログ確認

```bash
npx wrangler tail imgstk-worker
```

### Pages ログ確認

Cloudflare Dashboard → Workers & Pages → imgstk-pages → Logs

### R2 使用量確認

Cloudflare Dashboard → R2 → imgstk-bucket → Metrics

### D1 使用量確認

```bash
npx wrangler d1 info imgstk-db
```

---

**最終更新**: 2025-11-21
**デプロイ済み環境**:
- Worker: `stk.be2nd.com` (予定)
- Pages: `admin-stk.be2nd.com` (予定)
