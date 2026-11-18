import { useSyncExternalStore } from 'react';
import { defer, finalize, type Observable, tap } from 'rxjs';

/** How many fake datasource queries are running, and how the others ended. */
export interface FakeQueryStats {
  running: number;
  completed: number;
  canceled: number;
}

let stats: FakeQueryStats = { running: 0, completed: 0, canceled: 0 };
const listeners = new Set<() => void>();

function update(change: (prev: FakeQueryStats) => FakeQueryStats) {
  stats = change(stats);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Counts a query while it runs. A query that is unsubscribed before it
 * completes or errors counts as canceled, which is what lets a page (and the
 * e2e tests) see that canceling reached the datasource.
 */
export function trackQuery<T>(source: Observable<T>): Observable<T> {
  return defer(() => {
    let settled = false;
    update((s) => ({ ...s, running: s.running + 1 }));

    return source.pipe(
      tap({
        complete: () => (settled = true),
        error: () => (settled = true),
      }),
      finalize(() =>
        update((s) => ({
          running: s.running - 1,
          completed: s.completed + (settled ? 1 : 0),
          canceled: s.canceled + (settled ? 0 : 1),
        })),
      ),
    );
  });
}

export function useFakeQueryStats(): FakeQueryStats {
  return useSyncExternalStore(subscribe, () => stats);
}
