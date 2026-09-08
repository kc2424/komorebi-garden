#!/usr/bin/env node
/**
 * One-off Pl@ntNet smoke test via local dev API (max 2 calls).
 * Usage: node scripts/smoke-identify.mjs
 * Does not print API keys or env values.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function toDataUrl(filePath) {
  const buf = readFileSync(filePath);
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

async function identify(label, filePath) {
  const started = Date.now();
  const res = await fetch('http://127.0.0.1:5173/api/identify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl: toDataUrl(filePath) }),
  });
  const latencyMs = Date.now() - started;
  const json = await res.json();
  const top = json.candidates?.[0];
  return {
    label,
    photoType: label.includes('tulip') ? 'curated-real-wikimedia' : 'curated-non-tulip-bench',
    httpStatus: res.status,
    apiStatus: json.status,
    latencyMs,
    topCandidate: top
      ? {
          commonNameJa: top.commonNameJa,
          scientificName: top.scientificName,
          plantType: top.plantType,
          isTulipMatch: top.isTulipMatch,
          score: top.score,
        }
      : null,
    candidateCount: json.candidates?.length ?? 0,
  };
}

const cases = [
  ['real-red-tulip', join(root, 'public/samples/tulip.jpg')],
  ['negative-ajisai', join(root, 'public/samples/ajisai.jpg')],
];

const results = [];
for (const [label, path] of cases) {
  results.push(await identify(label, path));
}

console.log(JSON.stringify({ smokeTestAt: new Date().toISOString(), results }, null, 2));
