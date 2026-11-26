// Stands in for @grafana/query-ui's useVariableContextState in this app only.
// The probeVariableContextState plugin in vite.config.ts points query-ui's own
// imports of the hook here, so the package doesn't carry any measuring code.
import * as original from '../../../../packages/query-ui/src/variables/useVariableContextState';
import { useCommitCount } from './renderStats';

export * from '../../../../packages/query-ui/src/variables/useVariableContextState';

/**
 * Calls the real hook, then counts the commits of the variable that called it
 * as `useVariableContextState(<name>)`.
 */
export const useVariableContextState: typeof original.useVariableContextState =
  (input) => {
    const state = original.useVariableContextState(input);
    useCommitCount(`useVariableContextState(${input.name})`);
    return state;
  };
