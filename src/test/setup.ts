import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { resetLocalDbForTests } from '../storage/localDb';

beforeEach(async () => {
  resetLocalDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('komorebi-garden-db');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
});

Object.defineProperty(window, 'scrollTo', {
  value: () => {},
  writable: true,
});

class WebGLRenderingContextMock {}
// @ts-expect-error test shim
HTMLCanvasElement.prototype.getContext = vi.fn(() => new WebGLRenderingContextMock());

vi.stubGlobal(
  'ResizeObserver',
  vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })),
);

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
