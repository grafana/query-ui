import React, { useContext } from 'react';

import { useUrlState, type UrlValue } from '../url/UrlStateContext';
import {
  VariableContext,
  type VariableValue,
  type VariableValueOrValues,
  type VariableContextState,
  type VariableValueOption,
} from './types';

export interface DefineVariableProps {
  name: string;
  /**
   * The value to start from. Pass a list, even an empty one, to make this a
   * multi-value variable. See {@link useVariableContextState}.
   */
  value?: VariableValueOrValues;
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
  const context = useVariableContextState<VariableValueOrValues>({
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

interface VariableValueStateInput<T extends VariableValueOrValues> {
  name: string;
  /**
   * The value to start from. A list makes this a multi-value variable, which
   * syncs to one `var-<name>` query parameter per value. Whether it is a list
   * is read once, on mount.
   */
  value: T;
  loading?: boolean;
  parent?: VariableContextState<unknown>;
  /**
   * Keeps the value out of the URL. By default it is synced to the `var-<name>`
   * query parameter. Set it for the life of the variable.
   */
  skipUrlSync?: boolean;
}

/**
 * The value as the query string carries it: a string, or a list of strings for
 * a multi-value variable. Nothing selected is left out.
 */
function toUrlValue(value: VariableValueOrValues): UrlValue | undefined {
  if (Array.isArray(value)) {
    const values = value.flatMap((item) => toUrlValue(item) ?? []);

    return values.length > 0 ? values : undefined;
  }

  if (value.value === undefined || value.value === '') {
    return undefined;
  }

  return String(value.value);
}

/**
 * The value the query string holds, with the label of the matching option where
 * there is one.
 */
function fromUrlValue(
  urlValue: UrlValue,
  options: readonly VariableValueOption[],
): VariableValueOrValues {
  if (typeof urlValue !== 'string') {
    return urlValue.map((item) => fromUrlValue(item, options) as VariableValue);
  }

  const option = options.find((o) => String(o.value) === urlValue);

  return { value: urlValue, label: option?.label ?? urlValue };
}

function sameUrlValue(a: UrlValue | undefined, b: UrlValue | undefined) {
  if (a === undefined || b === undefined || typeof a === 'string') {
    return a === b;
  }

  return (
    typeof b !== 'string' &&
    a.length === b.length &&
    a.every((item, index) => item === b[index])
  );
}

export function useVariableContextState<
  T extends VariableValueOrValues = VariableValue,
>(input: VariableValueStateInput<T>): VariableContextState<T> {
  const [urlKey] = React.useState(() => `var-${input.name}`);
  const [isMulti] = React.useState(() => Array.isArray(input.value));
  const [urlState, updateUrlState] = useUrlState<Record<string, UrlValue>>(
    [urlKey],
    { skip: input.skipUrlSync, multiValueKeys: isMulti ? [urlKey] : [] },
  );
  const urlValue = urlState[urlKey];

  const [loading, setLoading] = React.useState(input.loading);
  // A value in the URL wins over the one the variable was given
  const [value, setValue] = React.useState<T>(() =>
    urlValue === undefined ? input.value : (fromUrlValue(urlValue, []) as T),
  );
  const [error, setError] = React.useState<Error | null>(null);
  const [options, setOptions] = React.useState<VariableValueOption[]>([]);

  // Pick up a change to the URL made from outside, like the back button. It is
  // set while rendering, so that the new value never shows up a render late.
  const [syncedUrlValue, setSyncedUrlValue] = React.useState(urlValue);

  if (!sameUrlValue(urlValue, syncedUrlValue)) {
    setSyncedUrlValue(urlValue);

    if (!sameUrlValue(urlValue, toUrlValue(value))) {
      // A parameter that is gone puts the variable back to where it started
      setValue(
        urlValue === undefined
          ? input.value
          : (fromUrlValue(urlValue, options) as T),
      );
    }
  }

  const onChange = React.useCallback(
    (newValue: T) => {
      setValue(newValue);
      updateUrlState({ [urlKey]: toUrlValue(newValue) } as Record<
        string,
        UrlValue
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
      getValue: (_fieldPath?: string, returnLabel?: boolean) => {
        if (Array.isArray(value)) {
          if (returnLabel) {
            return value.map((item) => item.label ?? item.value);
          }
          return value.map((item) => item.value);
        }

        if (returnLabel) {
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
