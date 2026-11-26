import {
  type ProfilerOnRenderCallback,
  useEffect,
  useSyncExternalStore,
} from 'react';

/**
 * What the probes on a page saw since the last reset: how many times each
 * probed component committed, and the values each probe recorded, in order.
 */
export interface RenderStats {
  renders: Record<string, number>;
  values: Record<string, string[]>;
  /** `performance.now()` of the last thing recorded, to tell when a page is quiet. */
  lastActivity: number;
}

/** Read by the e2e tests through `window.__renderStats`. */
export interface RenderStatsHandle {
  snapshot(): RenderStats;
  reset(): void;
}

declare global {
  interface Window {
    __renderStats?: RenderStatsHandle;
  }
}

function emptyStats(): RenderStats {
  return { renders: {}, values: {}, lastActivity: performance.now() };
}

let stats = emptyStats();
const listeners = new Set<() => void>();
let notifyScheduled = false;

// Probes record while React commits. Telling subscribers right away would
// update another component mid-commit, so they hear about it a task later.
function update(change: (prev: RenderStats) => RenderStats) {
  stats = { ...change(stats), lastActivity: performance.now() };

  if (notifyScheduled) {
    return;
  }

  notifyScheduled = true;
  setTimeout(() => {
    notifyScheduled = false;
    listeners.forEach((listener) => listener());
  });
}

export function countRender(id: string) {
  update((prev) => ({
    ...prev,
    renders: { ...prev.renders, [id]: (prev.renders[id] ?? 0) + 1 },
  }));
}

export function recordValue(id: string, value: string) {
  update((prev) => ({
    ...prev,
    values: { ...prev.values, [id]: [...(prev.values[id] ?? []), value] },
  }));
}

export function resetRenderStats() {
  update(emptyStats);
}

window.__renderStats = {
  snapshot: () => stats,
  reset: resetRenderStats,
};

/**
 * Counts every commit of the calling component. It counts commits rather than
 * calls to the render function, which StrictMode doubles in development. On
 * mount StrictMode runs effects twice, so a fresh mount counts 2.
 */
export function useCommitCount(id: string) {
  useEffect(() => {
    countRender(id);
  });
}

/** Records `value` each time it differs from the one the last commit had. */
export function useRecordValue(id: string, value: string) {
  useEffect(() => {
    recordValue(id, value);
  }, [id, value]);
}

/**
 * For a `<Profiler>`: counts every commit in which the profiled subtree
 * rendered, which is how components we can't instrument (like VizPanel) are
 * counted.
 *
 * Commits from a state update in a layout effect inside the subtree count
 * separately, as `<id> nested-update`. Whether one happens can depend on timing
 * (PanelChrome does this when loading starts, but not on every run), so
 * keeping them apart lets a test assert the other count exactly.
 */
export const countProfilerRender: ProfilerOnRenderCallback = (id, phase) => {
  countRender(phase === 'nested-update' ? `${id} nested-update` : id);
};

export function useRenderStats(): RenderStats {
  return useSyncExternalStore(subscribe, () => stats);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
