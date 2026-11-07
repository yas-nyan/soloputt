# SoloPutt

<img src="./site/assets/images/soloputt-mark.svg" alt="SoloPutt ロゴ" width="64" height="64">

ZeroPuttでパッティングを練習し、方向や距離感の傾向を振り返るための非公式Webアプリです。

[SoloPuttを開く](https://yas-nyan.github.io/soloputt/)

## 対応ブラウザ

ZeroPuttとの接続には、Bluetooth Low Energy（BLE）機器と通信できる **Web Bluetooth API** 対応ブラウザが必要です。SoloPuttをHTTPSで開き、接続時にBluetoothの利用を許可してください。

| 環境 | Web Bluetoothの対応状況 |
| --- | --- |
| MacのChrome、iPadのBluefy | SoloPuttで実機接続と計測を確認済み |
| WindowsのChrome・Edge、AndroidのChrome、ChromebookのChrome | API対応。SoloPuttでの実機確認は未実施 |
| iPhoneのBluefy | API対応。SoloPuttでの実機確認は未実施 |
| Safari、Firefox、iPhone・iPadの通常のChrome | 標準ではAPI非対応 |

ブラウザとOSの組み合わせによる違いは、公式資料で確認できます。[Web Bluetoothの実装状況](https://github.com/whatwg/bluetooth/blob/main/implementation-status.md) · [Bluefyの使い方](https://bluefy.app/guide.html)

## はじめて使う

1. MacではChrome、iPadではBluefyでSoloPuttを開きます。
2. ZeroPuttの電源を入れ、接続中のアプリがあれば切断します。
3. 練習ページで「ZeroPuttに接続」を押します。「準備完了」が出たら打てます。

機器が手元にない場合は、練習ページの「デモを試す」からカップイン・OK・ミスを再生できます。統計ページの「サンプル統計を見る」では、1,000球分の分析を試せます。

## 練習する

| メニュー | 練習内容 |
| --- | --- |
| 固定距離 | 同じ距離で打ち出しやタッチを揃える |
| ランダム | 指定した範囲で毎回距離を変える |
| ホールアウト | ミスしたら残り距離から続け、何打で終えたかを記録する |
| 実戦テスト20ホール | 「20ホール」を選び「20ホールを開始」を押す。開始距離を変えて回り、平均打数や3パット以上の割合を比べる |

OK圏内はZeroPuttのセンサーからカップまでの距離を基準に0.7 mで統一しています。ホールアウトをOKで終えた回は実際に打った数に1打を足して記録します。「練習セッション」を開始すると、テーマ・パター・マットと一緒に打球をまとめて記録できます。

## 振り返る

- **統計**で日別・距離別の成績、打ち出し方向、ショートとオーバーの分布を見られます。
- **詳しい分析**ではセッション内の10球ごとの変化、推定停止位置の散布図、ホールアウトの開始距離別の打数と初回の残り距離を確認できます。
- **日付比較**では、同じグリーン速度で両日に共通する距離帯のカップイン率を比べられます。

カップインは、平坦なグリーンを想定したSoloPutt独自の判定です。詳しい分析では現行モデルで再計算した結果も確認できます。保存済みのショットや打数は記録時の判定を保持します。[A. R. Penner, The physics of putting](https://doi.org/10.1139/p01-137)

## 履歴を管理する

記録は使用中のブラウザに保存されます。別の端末やブラウザに移す場合は、統計ページでCSVを書き出して取り込みます。履歴は1球ずつ、日付範囲、または全件を削除できます。デモの球は実打履歴に保存されません。
