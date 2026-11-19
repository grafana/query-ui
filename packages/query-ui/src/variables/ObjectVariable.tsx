import { property } from 'lodash';
import React, { useContext } from 'react';

import { VariableContext, type VariableContextState } from './types';

export interface ObjectVariableProps<T extends object> {
  name: string;
  value: T;
  children: React.ReactNode;
}

export function ObjectVariable<T extends object>({
  name,
  value,
  children,
}: ObjectVariableProps<T>) {
  const parentContext = useContext(VariableContext);
  const context = useVariableContextState({
    name,
    value: value,
    loading: false,
    parent: parentContext,
  });

  return (
    <VariableContext.Provider value={context}>
      {children}
    </VariableContext.Provider>
  );
}

interface VariableValueStateInput<T> {
  name: string;
  value: T;
  loading?: boolean;
  parent?: VariableContextState<unknown>;
}

function useVariableContextState<T>(
  input: VariableValueStateInput<T>,
): VariableContextState<T> {
  const [loading, setLoading] = React.useState(input.loading);
  const [value, setValue] = React.useState<T>(input.value);
  const [error, setError] = React.useState<Error | null>(null);

  return {
    name: input.name,
    value: value,
    loading,
    error,
    getValue: (_fieldPath?: string) => {
      return getFieldAccessor(_fieldPath ?? '')(value);
    },
    onChange: (newValue: T) => {
      setValue(newValue);
    },
    onSetLoading: setLoading,
    onSetError: setError,
    onOptionsChange: () => {},
    parent: input.parent,
  };
}

const fieldAccessorCache: FieldAccessorCache = {};

function getFieldAccessor(fieldPath: string) {
  const accessor = fieldAccessorCache[fieldPath];
  if (accessor) {
    return accessor;
  }

  return (fieldAccessorCache[fieldPath] = property(fieldPath));
}

interface FieldAccessorCache {
  [key: string]: (obj: unknown) => unknown;
}
