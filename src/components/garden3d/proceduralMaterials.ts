import * as THREE from 'three';

const EARTH_ROUGHNESS = 0.78;
const TURF_ROUGHNESS = 0.72;
const PETAL_ROUGHNESS = 0.87;
const LEAF_ROUGHNESS = 0.85;
const STEM_ROUGHNESS = 0.75;

const CANVAS_TEXTURE_SIZE = 1024;
const EARTH_ART_PATH = `${import.meta.env.BASE_URL}art/komorebi-earth-v1.png`;
const TURF_ART_PATH = `${import.meta.env.BASE_URL}art/komorebi-turf-v2.png`;

let earthTexture: THREE.CanvasTexture | null = null;
let earthBumpTexture: THREE.CanvasTexture | null = null;
let turfTexture: THREE.CanvasTexture | null = null;

function configureSurfaceTexture(texture: THREE.CanvasTexture, repeat: number): void {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
}

function drawEarthFallback(ctx: CanvasRenderingContext2D, size: number): void {
  const scale = size / 128;
  const dotCount = 420;

  ctx.fillStyle = '#95704e';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < dotCount; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = (0.5 + Math.random() * 2.0) * scale;
    const warm = Math.random();
    ctx.fillStyle =
      warm > 0.55
        ? `rgba(${158 + Math.random() * 22}, ${112 + Math.random() * 18}, ${72 + Math.random() * 16}, 0.28)`
        : `rgba(${108 + Math.random() * 16}, ${78 + Math.random() * 14}, ${52 + Math.random() * 12}, 0.32)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTurfFallback(ctx: CanvasRenderingContext2D, size: number): void {
  const patches = [
    { cx: 0.28, cy: 0.34, rx: 0.42, ry: 0.36, color: '#6f8445' },
    { cx: 0.72, cy: 0.62, rx: 0.38, ry: 0.44, color: '#758a4c' },
    { cx: 0.48, cy: 0.78, rx: 0.5, ry: 0.32, color: '#6a7f42' },
    { cx: 0.62, cy: 0.22, rx: 0.34, ry: 0.4, color: '#7a8f50' },
    { cx: 0.18, cy: 0.68, rx: 0.36, ry: 0.38, color: '#728748' },
  ];

  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#6d8244');
  gradient.addColorStop(0.55, '#74894a');
  gradient.addColorStop(1, '#6a7f42');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  for (const patch of patches) {
    const cx = patch.cx * size;
    const cy = patch.cy * size;
    const rx = patch.rx * size;
    const ry = patch.ry * size;
    const radial = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    radial.addColorStop(0, patch.color);
    radial.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = radial;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function createCanvasTextureWithArt(
  drawFallback: (ctx: CanvasRenderingContext2D, size: number) => void,
  artPath: string,
  repeat: number,
): THREE.CanvasTexture {
  const size = CANVAS_TEXTURE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
    fallback.needsUpdate = true;
    return fallback as unknown as THREE.CanvasTexture;
  }

  drawFallback(ctx, size);

  const texture = new THREE.CanvasTexture(canvas);
  configureSurfaceTexture(texture, repeat);

  const image = new Image();
  image.onload = () => {
    ctx.drawImage(image, 0, 0, size, size);
    texture.needsUpdate = true;
  };
  image.onerror = () => {
    // Retain procedural fallback; no throw.
  };
  image.src = artPath;

  return texture;
}

function createEarthTexture(): THREE.CanvasTexture {
  return createCanvasTextureWithArt(drawEarthFallback, EARTH_ART_PATH, 1);
}

function createEarthBumpTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
    fallback.needsUpdate = true;
    return fallback as unknown as THREE.CanvasTexture;
  }

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 600; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const shade = 110 + Math.random() * 35;
    ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
    ctx.fillRect(x, y, 1, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  return texture;
}

function createTurfTexture(): THREE.CanvasTexture {
  return createCanvasTextureWithArt(drawTurfFallback, TURF_ART_PATH, 1);
}

export function getEarthTexture(): THREE.CanvasTexture {
  if (!earthTexture) {
    earthTexture = createEarthTexture();
  }
  return earthTexture;
}

export function getEarthBumpTexture(): THREE.CanvasTexture {
  if (!earthBumpTexture) {
    earthBumpTexture = createEarthBumpTexture();
  }
  return earthBumpTexture;
}

export function getTurfTexture(): THREE.CanvasTexture {
  if (!turfTexture) {
    turfTexture = createTurfTexture();
  }
  return turfTexture;
}

export function createEarthMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: getEarthTexture(),
    bumpMap: getEarthBumpTexture(),
    bumpScale: 0.012,
    roughness: EARTH_ROUGHNESS,
    metalness: 0,
  });
}

export function createTurfMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: getTurfTexture(),
    roughness: TURF_ROUGHNESS,
    metalness: 0,
  });
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const value = parseInt(normalized, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')}`;
}

/** Shift RGB while preserving hue — avoids muddy purple on pink/coral bases. */
export function adjustTulipShade(hex: string, lightness: number, warmth = 0): string {
  const [r, g, b] = hexToRgb(hex);
  const warmR = r + warmth * 28;
  const warmG = g + warmth * 10;
  const warmB = b - warmth * 16;
  const lift = lightness * 72;
  const chroma = 1 - Math.abs(lightness) * 0.12;
  return rgbToHex(
    warmR * chroma + lift,
    warmG * chroma + lift * 0.92,
    warmB * chroma + lift * 0.82,
  );
}

/** THREE.Color(hex) already maps sRGB hex to working space in r185 — do not convert again. */
export function tulipVertexColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

export function createPetalMaterial(_baseHex: string, _inner = false): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: PETAL_ROUGHNESS,
    specularIntensity: 0.25,
    metalness: 0,
    clearcoat: 0,
    transmission: 0,
    sheen: 0,
    side: THREE.DoubleSide,
  });
}

export function createLeafMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: LEAF_ROUGHNESS,
    metalness: 0,
    side: THREE.DoubleSide,
  });
}

export function createStemMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#587340',
    roughness: STEM_ROUGHNESS,
    metalness: 0,
  });
}

export function createGrassMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.84,
    metalness: 0,
    side: THREE.DoubleSide,
  });
}

export function createGhostMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#9aab8e',
    transparent: true,
    opacity: 0.38,
    roughness: 0.95,
    metalness: 0,
  });
}
