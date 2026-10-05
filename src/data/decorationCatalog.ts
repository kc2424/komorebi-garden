import type { GardenDecorationType } from '../types';

export type DecorationCategory = 'rest' | 'path' | 'water' | 'growing' | 'ornament';

export interface DecorationCatalogEntry {
  id: GardenDecorationType;
  type: GardenDecorationType;
  label: string;
  description: string;
  category: DecorationCategory;
  icon: string;
  /** Conservative local model height, for camera framing. */
  height: number;
  /** Small static illustration; no WebGL context or external request needed in the catalog. */
  thumbnail: string;
}

function thumbnail(body: string): string {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 80"><ellipse cx="48" cy="68" rx="32" ry="7" fill="#4e6244" opacity=".12"/><g stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`)}`;
}

const entries: Array<Omit<DecorationCatalogEntry, 'id' | 'thumbnail'> & { artwork: string }> = [
  {
    type: 'bench', label: '木のベンチ', category: 'rest', icon: '🪑', height: 0.66,
    description: '花を眺める小さな休憩場所',
    artwork: '<path d="M25 44v24m46-24v24M27 22v30m42-30v30" stroke="#5d6558" stroke-width="6"/><rect x="18" y="24" width="60" height="10" rx="3" fill="#bd895b"/><rect x="17" y="42" width="62" height="12" rx="3" fill="#a9754f"/><path d="M22 47h52" stroke="#d3a777" stroke-width="2"/>',
  },
  {
    type: 'round-stone', label: '丸い石', category: 'ornament', icon: '🪨', height: 0.4,
    description: '草のそばに似合う、苔むした石',
    artwork: '<path d="M19 55 28 36 46 27 68 35 79 55 68 66 35 68Z" fill="#a8ac9b"/><path d="m28 36 18-9 22 8-17 13-25 6Z" fill="#c2c4b4"/><path d="m27 56 14-7 14 5-4 9-16 3Z" fill="#7c925f"/>',
  },
  {
    type: 'lantern', label: 'ランタン', category: 'ornament', icon: '🏮', height: 0.72,
    description: 'あたたかな光の目印',
    artwork: '<path d="M38 62h20l-3-28H41Z" fill="#62705c"/><rect x="36" y="27" width="24" height="21" rx="2" fill="#f3d28b" stroke="#59644f" stroke-width="3"/><path d="m29 26 19-14 19 14Z" fill="#5b6754"/><path d="M48 28v18M31 64h34" stroke="#5b6754" stroke-width="5"/><circle cx="48" cy="11" r="3" fill="#647256"/>',
  },
  {
    type: 'wood-fence', label: '木のフェンス', category: 'path', icon: '🪵', height: 0.6,
    description: '庭をやさしく区切る低い柵',
    artwork: '<path d="M19 30h59v9H19Zm0 20h59v9H19Z" fill="#c49a6c"/><path d="M20 66V25l5-7 5 7v41m18 0V25l5-7 5 7v41m17 0V25l5-7 5 7v41" fill="#af8054" transform="translate(-4 0)"/><path d="M23 29v29m28-29v29m27-29v29" stroke="#d8af7e" stroke-width="2"/>',
  },
  {
    type: 'birdbath', label: '小鳥の水鉢', category: 'water', icon: '🐦', height: 0.84,
    description: '小鳥がひと休みする水辺',
    artwork: '<path d="m36 65 7-30h10l7 30Z" fill="#aaa98f"/><ellipse cx="48" cy="64" rx="20" ry="5" fill="#c3bda4"/><path d="M21 29q3 15 27 15t27-15Z" fill="#b5b49d"/><ellipse cx="48" cy="28" rx="27" ry="8" fill="#8db8b2" stroke="#d0c7ad" stroke-width="5"/><ellipse cx="63" cy="19" rx="8" ry="6" fill="#869777"/><circle cx="69" cy="15" r="5" fill="#93a681"/><path d="m73 14 5 3-5 1m-17 0-8-4 4 7" fill="#bd955e"/>',
  },
  {
    type: 'fountain', label: '小さな噴水', category: 'water', icon: '⛲', height: 0.88,
    description: '静かな庭の中心になる水の飾り',
    artwork: '<ellipse cx="48" cy="60" rx="30" ry="10" fill="#acb2a5"/><ellipse cx="48" cy="57" rx="25" ry="7" fill="#87b9b9"/><path d="m40 57 5-25h6l5 25Z" fill="#b9bcab"/><path d="M30 31q3 12 18 12t18-12Z" fill="#c4c5b3"/><ellipse cx="48" cy="30" rx="18" ry="5" fill="#99c5c1"/><path d="M48 29V15m0 4q-11-12-16 6m16-6q11-12 16 6" fill="none" stroke="#93c7c7" stroke-width="3"/><circle cx="48" cy="13" r="3" fill="#b2dbd3"/>',
  },
  {
    type: 'flower-pot', label: '花の鉢', category: 'growing', icon: '🪴', height: 0.65,
    description: '花と葉を寄せ植えした素焼きの鉢',
    artwork: '<path d="M31 44h34l-5 22H36Z" fill="#c08160"/><rect x="28" y="40" width="40" height="8" rx="3" fill="#da9e77"/><path d="M47 41V23m0 12-12-8m13 8 12-12" stroke="#73874d" stroke-width="3"/><ellipse cx="36" cy="30" rx="9" ry="4" fill="#879c60" transform="rotate(35 36 30)"/><ellipse cx="58" cy="30" rx="9" ry="4" fill="#8a9d61" transform="rotate(-35 58 30)"/><g fill="#e4af8b"><circle cx="47" cy="18" r="6"/><circle cx="41" cy="23" r="6"/><circle cx="53" cy="23" r="6"/></g><circle cx="47" cy="23" r="4" fill="#e8cd7b"/>',
  },
  {
    type: 'watering-can', label: 'じょうろ', category: 'growing', icon: '🚿', height: 0.5,
    description: '置いてもかわいい、セージ色の道具',
    artwork: '<path d="M58 34q22-9 22 9T59 55" fill="none" stroke="#879f8a" stroke-width="5"/><path d="m35 51-16-7-8-14 8-3 10 12 11 2" fill="#879f8a"/><path d="M34 31h27v32q-15 7-29 0Z" fill="#92aa94"/><ellipse cx="47" cy="31" rx="14" ry="5" fill="#b3c3a6"/><ellipse cx="47" cy="31" rx="7" ry="3" fill="#5c745f"/><path d="m10 27 9-4 4 7-10 5Z" fill="#b3c3a6"/>',
  },
  {
    type: 'signpost', label: '道しるべ', category: 'path', icon: '🪧', height: 0.76,
    description: '小径の曲がり角に置く目印',
    artwork: '<path d="M46 22h7v46h-7Z" fill="#966b46"/><path d="M24 21h40l12 10-12 10H24Z" fill="#c89a68"/><path d="M30 29h25m-25 6h17" stroke="#a5774e" stroke-width="2"/><path d="m28 49 7-3 6 5-5 8-10-4Z" fill="#97a875"/>',
  },
  {
    type: 'garden-arch', label: '庭のアーチ', category: 'path', icon: '🌿', height: 1.22,
    description: '小径をくぐる、つるの入口',
    artwork: '<path d="M24 68V34a24 24 0 0 1 48 0v34" fill="none" stroke="#b79268" stroke-width="7"/><path d="M24 60h8m32 0h8M24 49h8m32 0h8" stroke="#c8a574" stroke-width="3"/><path d="M22 61q13-7 2-18t8-24M73 49q-12-11-4-22" fill="none" stroke="#7c9058" stroke-width="3"/><g fill="#9aaa6b"><ellipse cx="24" cy="53" rx="7" ry="3" transform="rotate(-30 24 53)"/><ellipse cx="25" cy="35" rx="7" ry="3" transform="rotate(40 25 35)"/><ellipse cx="36" cy="17" rx="7" ry="3" transform="rotate(-20 36 17)"/><ellipse cx="68" cy="34" rx="7" ry="3" transform="rotate(-35 68 34)"/></g><g fill="#dcaf9b"><circle cx="29" cy="25" r="4"/><circle cx="70" cy="42" r="4"/></g>',
  },
  {
    type: 'stepping-stones', label: '飛び石', category: 'path', icon: '👣', height: 0.13,
    description: '草地や水面につながる三つの石',
    artwork: '<path d="m48 20 17-2 10 9-8 10-20-2-6-8Z" fill="#b8b7a8"/><path d="m20 37 23-4 10 10-7 11-23 1-9-9Z" fill="#a9aea2"/><path d="m46 54 19-4 13 8-5 11-25 3-10-9Z" fill="#c4c0ae"/><path d="m47 23 15-2m-36 20 12-3m12 21 12-3" stroke="#d9d3bd" stroke-width="2"/>',
  },
  {
    type: 'mushroom', label: 'きのこ', category: 'ornament', icon: '🍄', height: 0.5,
    description: '木陰に似合う小さなきのこの親子',
    artwork: '<path d="M40 40h13l4 25q-12 5-20 0Z" fill="#e5d8b9"/><path d="M20 42q5-28 27-29 24 2 30 28Z" fill="#c38568"/><ellipse cx="47" cy="42" rx="27" ry="6" fill="#d8a986"/><g fill="#eddbb9"><circle cx="39" cy="24" r="4"/><circle cx="57" cy="27" r="5"/><circle cx="29" cy="36" r="3"/></g><path d="M69 57h6v12h-7Z" fill="#dfcfad"/><path d="M59 57q12-22 25 0Z" fill="#bb8a61"/>',
  },
];

export const DECORATION_CATALOG: readonly DecorationCatalogEntry[] = entries.map(
  ({ artwork, ...entry }) => ({ ...entry, id: entry.type, thumbnail: thumbnail(artwork) }),
);

export function getDecorationCatalogEntry(type: GardenDecorationType): DecorationCatalogEntry {
  return DECORATION_CATALOG.find((entry) => entry.type === type) ?? DECORATION_CATALOG[0];
}
