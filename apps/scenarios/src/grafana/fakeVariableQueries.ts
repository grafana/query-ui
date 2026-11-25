import { useSyncExternalStore } from 'react';

/** One variable query the fake labeled data source received. */
export interface FakeVariableQuery {
  query: string;
  searchFilter?: string;
}

let queries: readonly FakeVariableQuery[] = [];
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Logs a variable query as the data source receives it, which lets a page (and
 * the e2e tests) see when a query variable loads its options.
 */
export function trackVariableQuery(query: FakeVariableQuery) {
  queries = [...queries, query];
  listeners.forEach((listener) => listener());
}

export function useFakeVariableQueries(): readonly FakeVariableQuery[] {
  return useSyncExternalStore(subscribe, () => queries);
}
