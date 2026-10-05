import type { DiscoveryDraft } from '../types';
import { getLocalDb } from './localDb';

const ONBOARDING_KEY = 'onboarding-complete';
const DRAFT_KEY = 'discovery-draft';
const CURRENT_USER_KEY = 'current-user-id';
const SYNC_HALT_KEY = 'sync-halt-after-wipe';

export interface AppMeta {
  onboardingComplete: boolean;
  draft: DiscoveryDraft | null;
  currentUserId: string | null;
  syncHalted: boolean;
}

export async function loadAppMeta(): Promise<AppMeta> {
  const db = await getLocalDb();
  const [onboarding, draftRaw, userId, syncHalt] = await Promise.all([
    db.get('meta', ONBOARDING_KEY),
    db.get('meta', DRAFT_KEY),
    db.get('meta', CURRENT_USER_KEY),
    db.get('meta', SYNC_HALT_KEY),
  ]);

  let draft: DiscoveryDraft | null = null;
  if (draftRaw) {
    try {
      draft = JSON.parse(draftRaw) as DiscoveryDraft;
    } catch {
      draft = null;
    }
  }

  return {
    onboardingComplete: onboarding === 'true',
    draft,
    currentUserId: userId ?? null,
    syncHalted: syncHalt === 'true',
  };
}

export async function setOnboardingComplete(complete: boolean): Promise<void> {
  const db = await getLocalDb();
  await db.put('meta', complete ? 'true' : 'false', ONBOARDING_KEY);
}

export async function saveDraft(draft: DiscoveryDraft | null): Promise<void> {
  const db = await getLocalDb();
  if (draft) {
    await db.put('meta', JSON.stringify(draft), DRAFT_KEY);
  } else {
    await db.delete('meta', DRAFT_KEY);
  }
}

export async function setCurrentUserId(userId: string | null): Promise<void> {
  const db = await getLocalDb();
  if (userId) {
    await db.put('meta', userId, CURRENT_USER_KEY);
  } else {
    await db.delete('meta', CURRENT_USER_KEY);
  }
}

export async function setSyncHalted(halted: boolean): Promise<void> {
  const db = await getLocalDb();
  if (halted) {
    await db.put('meta', 'true', SYNC_HALT_KEY);
  } else {
    await db.delete('meta', SYNC_HALT_KEY);
  }
}

export async function clearDraftForScope(_scopeUserId: string | null): Promise<void> {
  await saveDraft(null);
}

export async function clearAllMeta(): Promise<void> {
  const db = await getLocalDb();
  const keys = await db.getAllKeys('meta');
  const tx = db.transaction('meta', 'readwrite');
  await Promise.all(keys.map((k) => tx.store.delete(k)));
  await tx.done;
}
