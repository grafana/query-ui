import React, { useContext } from 'react';

import {
  VariableContext,
  type VariableValueOption,
  type VariableValueOrValues,
} from './types';
import { useVariableContextState } from './useVariableContextState';

export interface DefineVariableProps {
  name: string;
  /**
   * The value to start with. Pass an array, even an empty one, to make this a
   * multi-value variable.
   */
  value?: VariableValueOrValues;
  /** The options to start with. */
  options?: VariableValueOption[];
  loading?: boolean;
  /** Keeps the value out of the URL. */
  skipUrlSync?: boolean;
  children: React.ReactNode;
}

export function DefineVariable({
  name,
  value,
  options,
  loading,
  skipUrlSync,
  children,
}: DefineVariableProps) {
  const parentContext = useContext(VariableContext);
  const context = useVariableContextState<VariableValueOrValues>({
    name,
    value: value ?? {},
    options,
    loading,
    parent: parentContext,
    skipUrlSync,
  });

  return (
    <VariableContext.Provider value={context}>
      {children}
    </VariableContext.Provider>
  );
}
