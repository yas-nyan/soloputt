# SoloPutt

ZeroPuttの非公式Webクライアントです。ブラウザで機器に接続し、直近のパットの推定距離、打ち出し方向、表示速度を確認できます。ページは受信値を表示し、リロードすると表示が消えます。

## 試し方

1. ZeroPuttの電源を入れ、使用中の公式アプリや別のBLEクライアントを切断する。
2. iPadのBluefy、またはMacのChromeで同じHTTPSページを開く。
3. 「ZeroPuttに接続」を押して機器を選び、「計測準備完了」を待つ。
4. 1球打って3項目が更新されることを確認する。「通信ログ」で `RX 0` と `TX 9` を確認する。
5. 「切断」を押してから、もう一方の端末で同じ手順を行う。

BluefyとChromeでの実機互換性は上記の手順で確認してください。

## ディレクトリ構成

```text
site/
  index.html       BLE計測ページ
  assets/css/      スタイル
  assets/js/       BLE通信と画面のJavaScript
tests/             通信のテスト
.github/workflows/ GitHub Pagesの配信設定
```

ページを追加するときは `site/config/index.html`、`site/stats/index.html`、`site/tools/ble-test/index.html` のように配置できます。GitHub Pagesではリポジトリ名がURLのパスに入るので、ページやアセットへの参照は各ページからの相対パスを使います。

## ローカル実行

MacのChromeで開発する場合は、リポジトリのルートで次を実行して `http://localhost:8000/` を開きます。

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory site
```

## GitHub Pagesで公開

1. リポジトリの **Settings → Pages → Build and deployment** で **Source** を **GitHub Actions** に設定します。
2. ワークフローを含む変更を `main` にpushします。設定より先にpushした場合は、**Actions → Deploy GitHub Pages → Run workflow** で `main` を選んで実行します。
3. デプロイが成功したら、**Settings → Pages** に表示されるHTTPSのURLを開きます。iPadではBluefyで開きます。

ワークフローはNode.jsでテストを実行し、成功すると `site/` の中身だけを公開します。公開URLの入口は `site/index.html` です。

## 通信の概要

カスタムGATTサービスの通知を購読し、ASCIIの改行区切りで通信します。観測済みの初期化手順に合わせ、`6` への応答を受けて7秒待ち、`2` を送ります。設定応答 `3,...` を受けると計測準備完了です。計測通知 `0,...` に `9`、`B` に `B` を返します。UUIDと通知の各フィールドは [protocol.mjs](site/assets/js/protocol.mjs) にあります。

## テスト

Node.js 24以降で実行できます。

```sh
node --test 'tests/**/*.test.mjs'
```
