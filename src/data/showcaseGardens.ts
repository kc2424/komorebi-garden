import type {
  GardenDecoration,
  GardenDecorationType,
  GardenModelType,
  GardenPlant,
  SoilTile,
  TileSurface,
  TulipColor,
} from '../types';
import type { GardenVisit } from '../utils/gardenInvite';

const tileId = (x: number, z: number) => `showcase-tile-${x}-${z}`;

function makeGrid(
  radius: number,
  surfaceAt: (x: number, z: number) => TileSurface = () => 'grass',
  heightAt: (x: number, z: number) => number = () => 0,
): SoilTile[] {
  const tiles: SoilTile[] = [];
  for (let x = -radius; x <= radius; x += 1) {
    for (let z = -radius; z <= radius; z += 1) {
      tiles.push({ id: tileId(x, z), x, z, surface: surfaceAt(x, z), height: heightAt(x, z) });
    }
  }
  return tiles;
}

function plant(
  id: string,
  x: number,
  z: number,
  modelType: GardenModelType,
  rotation: number,
  color: TulipColor = 'red',
): GardenPlant {
  return { id, tileId: tileId(x, z), modelType, color, rotation };
}

function decoration(
  id: string,
  x: number,
  z: number,
  type: GardenDecorationType,
  rotation = 0,
): GardenDecoration {
  return { id, tileId: tileId(x, z), type, rotation };
}

const expandedSoil = makeGrid(
  3,
  (x, z) => {
    if ((x === -3 || x === -2) && z >= 1) return 'water';
    if (x === 0 || (z === 1 && x >= -1)) return 'stone';
    if (x === -1 && z >= 2) return 'gravel';
    if (x >= 2 && z >= 2) return 'wood';
    return 'grass';
  },
  (x, z) => {
    if (z === -3) return 2;
    if (z === -2) return x === -1 ? 2 : 1;
    return 0;
  },
);

const expandedPlants: GardenPlant[] = [
  plant('expanded-plant-0', -3, -3, 'maple', 1),
  plant('expanded-plant-1', 3, -3, 'cherry', 0.3),
  plant('expanded-plant-2', -2, -2, 'sunflower', 1),
  plant('expanded-plant-3', 2, -2, 'allium', 0.3),
  plant('expanded-plant-4', -2, 0, 'tulip', 1),
  plant('expanded-plant-5', -1, -1, 'cosmos', 0.3),
  plant('expanded-plant-6', 1, 0, 'pansy', 1),
  plant('expanded-plant-7', -3, 0, 'daisy', 0.3),
  plant('expanded-plant-8', 1, -2, 'lavender', 1),
  plant('expanded-plant-9', -1, -3, 'rose', 0.3),
  plant('expanded-plant-10', 2, -3, 'hydrangea', 1),
  plant('expanded-plant-11', 1, 2, 'marigold', 0.3),
  plant('expanded-plant-12', -1, 0, 'daffodil', 1),
  plant('expanded-plant-13', -2, -3, 'lily', 0.3),
  plant('expanded-plant-14', 2, 0, 'poppy', 1),
  plant('expanded-plant-15', 3, -1, 'bluebell', 0.3),
  plant('expanded-plant-16', -2, -1, 'forget-me-not', 1),
  plant('expanded-plant-17', 3, 0, 'fern', 0.3),
  plant('expanded-plant-18', 1, -3, 'hosta', 1),
  plant('expanded-plant-19', -3, -1, 'ornamental-grass', 0.3),
];

const expandedDecorations: GardenDecoration[] = [
  decoration('expanded-decoration-0', 3, 2, 'bench'),
  decoration('expanded-decoration-1', -3, 2, 'round-stone'),
  decoration('expanded-decoration-2', 1, 1, 'lantern'),
  decoration('expanded-decoration-3', 3, 3, 'wood-fence'),
  decoration('expanded-decoration-4', 1, -1, 'birdbath'),
  decoration('expanded-decoration-5', 0, 0, 'fountain'),
  decoration('expanded-decoration-6', 2, 2, 'flower-pot'),
  decoration('expanded-decoration-7', 2, 3, 'watering-can'),
  decoration('expanded-decoration-8', 0, 3, 'signpost'),
  decoration('expanded-decoration-9', 0, 2, 'garden-arch'),
  decoration('expanded-decoration-10', -2, 2, 'stepping-stones'),
  decoration('expanded-decoration-11', -3, -2, 'mushroom'),
];

const watersideSoil = makeGrid(
  2,
  (x, z) => {
    if (x === -2 || (x === -1 && z >= 1)) return 'water';
    if (z === 0) return 'stone';
    if (x >= 1 && z <= -1) return 'wood';
    return 'grass';
  },
  (x, z) => (x === 2 && z === 2 ? 1 : 0),
);

const watersidePlants: GardenPlant[] = [
  plant('waterside-plant-0', 2, 2, 'maple', 0.5),
  plant('waterside-plant-1', 1, 2, 'fern', 1.2),
  plant('waterside-plant-2', 0, 2, 'hosta', 0.2),
  plant('waterside-plant-3', 2, 1, 'fern', 0.7),
  plant('waterside-plant-4', 0, -2, 'ornamental-grass', 0.3),
  plant('waterside-plant-5', -1, -2, 'forget-me-not', 0.9),
];

const watersideDecorations: GardenDecoration[] = [
  decoration('waterside-decoration-0', 2, -1, 'bench', Math.PI / 2),
  decoration('waterside-decoration-1', 1, -1, 'bench', Math.PI / 2),
  decoration('waterside-decoration-2', -1, 1, 'stepping-stones', 0.4),
  decoration('waterside-decoration-3', -2, -1, 'round-stone'),
  decoration('waterside-decoration-4', 1, -2, 'lantern'),
];

const courtyardSoil = makeGrid(
  3,
  (x, z) => {
    if (Math.abs(x) <= 1 && Math.abs(z) <= 1) return 'gravel';
    if (x === 0 || z === 0) return 'stone';
    if (Math.abs(x) === 3 || Math.abs(z) === 3) return 'soil';
    return 'grass';
  },
);

const courtyardPlants: GardenPlant[] = [
  plant('courtyard-plant-0', -3, -3, 'rose', 0.2, 'red'),
  plant('courtyard-plant-1', -2, -3, 'rose', 0.7, 'pink'),
  plant('courtyard-plant-2', 2, -3, 'rose', 1.1, 'white'),
  plant('courtyard-plant-3', 3, -3, 'rose', 0.4, 'red'),
  plant('courtyard-plant-4', -3, 3, 'rose', 1.4, 'pink'),
  plant('courtyard-plant-5', -2, 3, 'rose', 0.1, 'white'),
  plant('courtyard-plant-6', 2, 3, 'rose', 0.8, 'red'),
  plant('courtyard-plant-7', 3, 3, 'rose', 1.2, 'pink'),
  plant('courtyard-plant-8', -3, -1, 'lavender', 0.5),
  plant('courtyard-plant-9', -3, 1, 'lavender', 0.9),
  plant('courtyard-plant-10', 3, -1, 'hydrangea', 0.3),
  plant('courtyard-plant-11', 3, 1, 'hydrangea', 1.1),
];

const courtyardDecorations: GardenDecoration[] = [
  decoration('courtyard-decoration-0', 0, 0, 'fountain'),
  decoration('courtyard-decoration-1', 0, -3, 'garden-arch'),
  decoration('courtyard-decoration-2', 0, 3, 'garden-arch', Math.PI),
  decoration('courtyard-decoration-3', -2, 0, 'bench'),
  decoration('courtyard-decoration-4', 2, 0, 'bench', Math.PI),
  decoration('courtyard-decoration-5', -1, -1, 'flower-pot'),
  decoration('courtyard-decoration-6', 1, 1, 'flower-pot'),
  decoration('courtyard-decoration-7', 1, -1, 'lantern'),
];

export const SHOWCASE_GARDENS: readonly GardenVisit[] = [
  {
    id: 'expanded-showcase',
    title: '丘と水辺の植物園',
    author: 'こもれび植物園',
    description: '20種類の植物、12種類の飾り、段差と地面の素材を一度に見渡せる作例です。',
    source: 'sample',
    thumbnail: '/samples/expanded-garden-example.png',
    soilTiles: expandedSoil,
    plants: expandedPlants,
    decorations: expandedDecorations,
  },
  {
    id: 'quiet-waterside',
    title: '静かな水辺の庭',
    author: 'こもれび植物園',
    description: '5×5の小さな庭。モミジとシダ、木のデッキ、並んだベンチで落ち着く居場所をつくりました。',
    source: 'sample',
    thumbnail: '/samples/waterside-garden-example.jpg',
    soilTiles: watersideSoil,
    plants: watersidePlants,
    decorations: watersideDecorations,
  },
  {
    id: 'rose-courtyard',
    title: 'バラの中庭',
    author: 'こもれび植物園',
    description: '7×7の左右対称な中庭。アーチをくぐり、石の小径から噴水とバラの花壇へ進みます。',
    source: 'sample',
    thumbnail: '/samples/courtyard-garden-example.jpg',
    soilTiles: courtyardSoil,
    plants: courtyardPlants,
    decorations: courtyardDecorations,
  },
];
