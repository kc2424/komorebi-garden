import { getLocalDb } from './localDb';

export function imageRefForObservation(observationId: string): string {
  return `img-${observationId}`;
}

export async function saveImage(ref: string, dataUrl: string): Promise<void> {
  const db = await getLocalDb();
  await db.put('images', { ref, dataUrl, updatedAt: new Date().toISOString() });
}

export async function loadImage(ref: string): Promise<string | null> {
  const db = await getLocalDb();
  const row = await db.get('images', ref);
  return row?.dataUrl ?? null;
}

export async function deleteImage(ref: string): Promise<void> {
  const db = await getLocalDb();
  await db.delete('images', ref);
}

export async function deleteImages(refs: string[]): Promise<void> {
  const db = await getLocalDb();
  const tx = db.transaction('images', 'readwrite');
  await Promise.all(refs.map((ref) => tx.store.delete(ref)));
  await tx.done;
}

export async function listAllImageRefs(): Promise<string[]> {
  const db = await getLocalDb();
  const keys = await db.getAllKeys('images');
  return keys;
}
