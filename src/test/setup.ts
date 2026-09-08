import '@testing-library/jest-dom';
import { vi } from 'vitest';

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
