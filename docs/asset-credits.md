# 写真アセットのクレジット

サンプル写真は Wikimedia Commons からダウンロードした JPEG です。アプリ内表示用に 960px 幅サムネイルを取得し、ユーザー登録時に長辺 1280px・JPEG 品質 90 で圧縮しています（識別 API 送信用、research 10）。

| ファイル | 植物 | 作者 | ライセンス | 元ファイル |
|---------|------|------|-----------|-----------|
| sakura.jpg | ソメイヨシノ | 松岡明芳 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [Commons](https://commons.wikimedia.org/wiki/File:2020-04-07_Prunus_%C3%97_yedoensis_Tambasasayama,Hyogo(%E4%B8%B9%E6%B3%A2%E7%AF%A0%E5%B1%B1%E5%B8%82%E7%AF%A0%E5%B1%B1%E5%B7%9D%E3%81%AE%E3%82%BD%E3%83%A1%E3%82%A4%E3%83%A8%E3%82%B7%E3%83%8E)DSCF2986%E2%98%86%E5%BD%A1.jpg) |
| ajisai.jpg | 紫陽花 | Yamaguchi Yoshiaki | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0) | [Commons](https://commons.wikimedia.org/wiki/File:Hydrangea_of_Shimoda_%E4%B8%8B%E7%94%B0%E3%81%AE%E3%81%82%E3%81%98%E3%81%95%E3%81%84_(2630826953).jpg) |
| yamabuki.jpg | 山吹 | ignis | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | [Commons](https://commons.wikimedia.org/wiki/File:Kerria_japonica_001_JPN.jpg) |
| tsubaki.jpg | 椿 | PumpkinSky | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | [Commons](https://commons.wikimedia.org/wiki/File:Camellia_japonica_NBG.jpg) |
| kinmokusei.jpg | 金木犀 | Laitr Keiows | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | [Commons](https://commons.wikimedia.org/wiki/File:Osmanthus_fragrans_(orange_flowers).jpg) |
| ayame.jpg | アヤメ | Alpsdake | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | [Commons](https://commons.wikimedia.org/wiki/File:Iris_sanguinea.JPG) |
| tulip.jpg | チューリップ（Tulipa gesneriana） | Bernt Fransson | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [Commons](https://commons.wikimedia.org/wiki/File:Tulpan_(Tulipa_gesneriana)_005.jpg) |
| kikyo.jpg | 桔梗 | 663highland | [CC BY 2.5](https://creativecommons.org/licenses/by/2.5) | [Commons](https://commons.wikimedia.org/wiki/File:130803_Tonomine_highland_Kamikawa_Hyogo_pref_Japan10bs5.jpg) |
| nadeshiko.jpg | ナデシコ | Bernd Haynold | [CC BY-SA 2.5](https://creativecommons.org/licenses/by-sa/2.5) | [Commons](https://commons.wikimedia.org/wiki/File:Dianthus_superbus_140805a.jpg) |
| ume.jpg | 梅 | Kakidai | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | [Commons](https://commons.wikimedia.org/wiki/File:Prunus_mume.JPG) |
| fuji.jpg | 藤 | Raul654 | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | [Commons](https://commons.wikimedia.org/wiki/File:Wisteria_floribunda5.jpg) |

絵本の庭の植物イラストは `src/components/illustrations/PlantIllustration.tsx` 内のオリジナル SVG です。

庭の背景画像 `public/art/garden-backdrop.png` は配置済み。未配置時は CSS フォールバックを使用します。

アプリ内でも「写真」ボタンから本一覧を参照できます。
