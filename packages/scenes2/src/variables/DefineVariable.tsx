import React, { useContext } from 'react';

import { useUrlState } from '../url/UrlStateContext';
import {
  VariableContext,
  type VariableValue,
  type VariableContextState,
  type VariableValueOption,
} from './types';

export interface DefineVariableProps {
  name: string;
  value?: VariableValue;
  loading?: boolean;
  /** Keeps the value out of the URL. See {@link useVariableContextState}. */
  skipUrlSync?: boolean;
  children: React.ReactNode;
}

export function DefineVariable({
  name,
  value,
  loading,
  skipUrlSync,
  children,
}: DefineVariableProps) {
  const parentContext = useContext(VariableContext);
  const context = useVariableContextState({
    name,
    value: value ?? {},
    loading: loading,
    parent: parentContext,
    skipUrlSync,
  });

  return (
    <VariableContext.Provider value={context}>
      {children}
    </VariableContext.Provider>
  );
}

interface VariableValueStateInput {
  name: string;
  value: VariableValue;
  loading?: boolean;
  parent?: VariableContextState<unknown>;
  /**
   * Keeps the value out of the URL. By default it is synced to the `var-<name>`
   * query parameter. Set it for the life of the variable.
   */
  skipUrlSync?: boolean;
}

/** The value as the query string carries it. Nothing selected is left out. */
function toUrlValue(value: VariableValue): string | undefined {
  if (value.value === undefined || value.value === '') {
    return undefined;
  }

  return String(value.value);
}

export function useVariableContextState(
  input: VariableValueStateInput,
): VariableContextState<VariableValue> {
  const [urlKey] = React.useState(() => `var-${input.name}`);
  const [urlState, updateUrlState] = useUrlState<Record<string, string>>(
    [urlKey],
    { skip: input.skipUrlSync },
  );
  const urlValue = urlState[urlKey];

  const [loading, setLoading] = React.useState(input.loading);
  // A value in the URL wins over the one the variable was given
  const [value, setValue] = React.useState<VariableValue>(() =>
    urlValue === undefined ? input.value : { value: urlValue, label: urlValue },
  );
  const [error, setError] = React.useState<Error | null>(null);
  const [options, setOptions] = React.useState<VariableValueOption[]>([]);

  // Pick up a change to the URL made from outside, like the back button. It is
  // set while rendering, so that the new value never shows up a render late.
  const [syncedUrlValue, setSyncedUrlValue] = React.useState(urlValue);

  if (urlValue !== syncedUrlValue) {
    setSyncedUrlValue(urlValue);

    if (urlValue !== toUrlValue(value)) {
      const option = options.find((o) => String(o.value) === urlValue);

      // A parameter that is gone puts the variable back to where it started
      setValue(
        urlValue === undefined
          ? input.value
          : { value: urlValue, label: option?.label ?? urlValue },
      );
    }
  }

  const onChange = React.useCallback(
    (newValue: VariableValue) => {
      setValue(newValue);
      updateUrlState({ [urlKey]: toUrlValue(newValue) } as Record<
        string,
        string
      >);
    },
    [updateUrlState, urlKey],
  );

  return React.useMemo(
    () => ({
      name: input.name,
      value,
      loading,
      error,
      options,
      getValue: (fieldPath?: string) => {
        if (fieldPath === 'text') {
          return value.label;
        }

        return value.value;
      },
      onChange,
      onOptionsChange: setOptions,
      onSetLoading: setLoading,
      onSetError: setError,
      parent: input.parent,
    }),
    [input.name, value, loading, error, options, onChange, input.parent],
  );
}
