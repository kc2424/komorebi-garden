# 箱庭の遊びを広げる — 2026-10-04

画像認識は今回の集中開発の対象から外し、庭を自由に作り、眺め、また触りたくなる試遊版を仕上げる。現行 c771 の未コミット統合全体を基礎とする。公開・Gitコミットはしない。

## 今回の到達点

- 眺める画面の初期状態は庭の全景。常に「庭全体を見る」で戻れ、植物を選んだ後も自由に回せる。
- 草花・葉もの・木を含む20種類。色替えだけで種類数を増やさず、輪郭に違いを作る。
- 12種類の飾り、6種類の地面、4段階の高さで小径・池・ウッドデッキ・段々の庭を作れる。
- 植える、連続配置、向き、移動、しまう、元に戻す、保存して再訪する一連の操作が成立する。
- スマホ・タブレット・PCで、画面端や操作パネルに阻まれず主要操作ができる。iOS Simulatorのネイティブアプリでも確認する。

## 実装上の合意

植物は既存Three.jsに適した頂点色の結合ジオメトリと共有材質を使い、カタログは静的SVGで表示する。植物ごとのWebGLキャンバスは増やさない。Blenderは有機的で複雑なモデルを後日作る候補とし、この小さな低ポリゴンの庭に必須の依存を加えない。実際の頂点・三角形数と実画面を確認して判断する。

`SoilTile.height` は省略時0、整数0〜3、1段0.32。地面を高くしたら植物・飾り・配置プレビュー・選択表示も同じ高さに追従する。変更は既存の保存キューとUndo/Redoに載せる。地面はgrass/soil/stone/gravel/wood/water。

植物20種: tulip, cosmos, pansy, daisy, sunflower, lavender, rose, hydrangea, marigold, daffodil, lily, poppy, bluebell, forget-me-not, allium, fern, hosta, ornamental-grass, maple, cherry。

飾り12種: bench, round-stone, lantern, wood-fence, birdbath, fountain, flower-pot, watering-can, signpost, garden-arch, stepping-stones, mushroom。

## 受け入れ確認

1. 全景→植物を選ぶ→全景へ戻る→回す、を各画面サイズで確認。
2. 新しい植物と飾りを配置し、地面の素材と高さを変え、Undo/Redoと再読込で一致する。
3. 保存済みの観察写真・明示的なobservationIds・しまった植物を保持する。壊れたバックアップや古い保存値は既存の安全な読み込み規則で扱う。
4. 型チェック・本番build・回帰テストを通し、ブラウザとiOS Simulatorで表示と主要操作を確認。実機未確認の点は明記する。

追加エージェントは今回の明示指定に従いAstra Ultra。担当は植物、地形/飾り/保存、カメラ/画面。ルートは統合・描画・端末検証を担当する。
