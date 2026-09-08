export interface AssetCredit {
  illustrationId: string;
  plantName: string;
  fileName: string;
  sourcePage: string;
  creator: string;
  license: string;
  licenseUrl: string;
  modifications: string;
}

export const ASSET_CREDITS: AssetCredit[] = [
  {
    illustrationId: 'sakura',
    plantName: 'ソメイヨシノ',
    fileName: 'sakura.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:2020-04-07_Prunus_%C3%97_yedoensis_Tambasasayama,Hyogo(%E4%B8%B9%E6%B3%A2%E7%AF%A0%E5%B1%B1%E5%B8%82%E7%AF%A0%E5%B1%B1%E5%B7%9D%E3%81%AE%E3%82%BD%E3%83%A1%E3%82%A4%E3%83%A8%E3%82%B7%E3%83%8E)DSCF2986%E2%98%86%E5%BD%A1.jpg',
    creator: '松岡明芳',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    modifications: '960px 幅のサムネイルをダウンロード。アプリ内表示用にリサイズ・JPEG圧縮（登録時）。',
  },
  {
    illustrationId: 'ajisai',
    plantName: '紫陽花',
    fileName: 'ajisai.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Hydrangea_of_Shimoda_%E4%B8%8B%E7%94%B0%E3%81%AE%E3%81%82%E3%81%98%E3%81%95%E3%81%84_(2630826953).jpg',
    creator: 'Yamaguchi Yoshiaki',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0',
    modifications: '960px 幅のサムネイルをダウンロード。アプリ内表示用にリサイズ・JPEG圧縮（登録時）。',
  },
  {
    illustrationId: 'yamabuki',
    plantName: '山吹',
    fileName: 'yamabuki.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Kerria_japonica_001_JPN.jpg',
    creator: 'ignis',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    modifications: '960px 幅のサムネイルをダウンロード。アプリ内表示用にリサイズ・JPEG圧縮（登録時）。',
  },
  {
    illustrationId: 'tsubaki',
    plantName: '椿',
    fileName: 'tsubaki.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Camellia_japonica_NBG.jpg',
    creator: 'PumpkinSky',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    modifications: '960px 幅のサムネイルをダウンロード。アプリ内表示用にリサイズ・JPEG圧縮（登録時）。',
  },
  {
    illustrationId: 'kinmokusei',
    plantName: '金木犀',
    fileName: 'kinmokusei.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Osmanthus_fragrans_(orange_flowers).jpg',
    creator: 'Laitr Keiows',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    modifications: '960px 幅のサムネイルをダウンロード。アプリ内表示用にリサイズ・JPEG圧縮（登録時）。',
  },
  {
    illustrationId: 'ayame',
    plantName: 'アヤメ',
    fileName: 'ayame.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Iris_sanguinea.JPG',
    creator: 'Alpsdake',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    modifications: '960px 幅のサムネイルをダウンロード。アプリ内表示用にリサイズ・JPEG圧縮（登録時）。',
  },
  {
    illustrationId: 'tulip',
    plantName: 'チューリップ（Tulipa gesneriana）',
    fileName: 'tulip.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Tulpan_(Tulipa_gesneriana)_005.jpg',
    creator: 'Bernt Fransson',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    modifications: '960px 幅のサムネイルをダウンロード。アプリ内表示用にリサイズ・JPEG圧縮（登録時）。',
  },
  {
    illustrationId: 'kikyo',
    plantName: '桔梗',
    fileName: 'kikyo.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:130803_Tonomine_highland_Kamikawa_Hyogo_pref_Japan10bs5.jpg',
    creator: '663highland',
    license: 'CC BY 2.5',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.5',
    modifications: '960px 幅のサムネイルをダウンロード。アプリ内表示用にリサイズ・JPEG圧縮（登録時）。',
  },
  {
    illustrationId: 'nadeshiko',
    plantName: 'ナデシコ',
    fileName: 'nadeshiko.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Dianthus_superbus_140805a.jpg',
    creator: 'Bernd Haynold',
    license: 'CC BY-SA 2.5',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.5',
    modifications: '960px 幅のサムネイルをダウンロード。アプリ内表示用にリサイズ・JPEG圧縮（登録時）。',
  },
  {
    illustrationId: 'ume',
    plantName: '梅',
    fileName: 'ume.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Prunus_mume.JPG',
    creator: 'Kakidai',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    modifications: '960px 幅のサムネイルをダウンロード。アプリ内表示用にリサイズ・JPEG圧縮（登録時）。',
  },
  {
    illustrationId: 'fuji',
    plantName: '藤',
    fileName: 'fuji.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Wisteria_floribunda5.jpg',
    creator: 'Raul654',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    modifications: '960px 幅のサムネイルをダウンロード。アプリ内表示用にリサイズ・JPEG圧縮（登録時）。',
  },
];

export function samplePhotoPath(illustrationId: string): string {
  return `/samples/${illustrationId}.jpg`;
}
