import '@testing-library/jest-dom/vitest';

// jsdom lacks the browser APIs that uplot (loaded through @grafana/ui and
// @grafana/runtime) calls when its module loads. These are the same stubs the
// create-plugin Jest setup adds.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
