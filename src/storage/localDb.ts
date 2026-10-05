import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

const DB_NAME = 'komorebi-garden-db';
const DB_VERSION = 1;

export interface LocalDbSchema extends DBSchema {
  meta: {
    key: string;
    value: string;
  };
  images: {
    key: string;
    value: {
      ref: string;
      dataUrl: string;
      updatedAt: string;
    };
  };
  garden: {
    key: string;
    value: {
      userScope: string;
      stateJson: string;
      updatedAt: string;
    };
  };
  shelved: {
    key: string;
    value: {
      id: string;
      userScope: string;
      label: string;
      stateJson: string;
      savedAt: string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<LocalDbSchema>> | null = null;

export function getLocalDb(): Promise<IDBPDatabase<LocalDbSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<LocalDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta');
        }
        if (!db.objectStoreNames.contains('images')) {
          db.createObjectStore('images', { keyPath: 'ref' });
        }
        if (!db.objectStoreNames.contains('garden')) {
          db.createObjectStore('garden', { keyPath: 'userScope' });
        }
        if (!db.objectStoreNames.contains('shelved')) {
          db.createObjectStore('shelved', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export function resetLocalDbForTests(): void {
  dbPromise = null;
}

export const GUEST_SCOPE = 'guest';

export function scopeForUser(userId: string | null): string {
  return userId ?? GUEST_SCOPE;
}
