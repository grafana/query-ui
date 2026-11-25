import React from 'react';

import { useCache } from '../caching/CacheContext';
import { useUrlState, type UrlValue } from '../url/UrlStateContext';
import type {
  VariableContextState,
  VariableValue,
  VariableValueOption,
  VariableValueOrValues,
} from './types';

export interface VariableValueStateInput<T extends VariableValueOrValues> {
  name: string;
  /**
   * The value to start with. A list makes this a multi-value variable, which
   * syncs to one `var-<name>` query parameter per value. Whether it is a list
   * is read once, on mount.
   */
  value: T;
  /**
   * The options to start with, until a query replaces them. They also give a
   * value read from the URL its label. Read once, on mount.
   */
  options?: VariableValueOption[];
  /**
   * Whether the variable starts out loading. Left out, it does when it has no
   * value to start from, once the URL and the cache have been checked. Read
   * once, on mount.
   */
  loading?: boolean;
  parent?: VariableContextState<unknown>;
  /**
   * Keeps the value out of the URL. By default it is synced to the `var-<name>`
   * query parameter. Set it for the life of the variable.
   */
  skipUrlSync?: boolean;
  /**
   * Remembers the value under the variable name, so a later mount of a variable
   * with the same `name` starts where this one left off. A remembered value
   * wins over `value`, and a value in the URL wins over both. The closest
   * `CacheProvider` holds it; give a subtree its own to scope it. Read once,
   * on mount.
   */
  rememberValue?: boolean;
}

/**
 * The state behind a variable: its value, options, loading and error, with the
 * value synced to the `var-<name>` query parameter.
 *
 * `onOptionsChange` also checks the value against the new options and ends
 * loading, so a variable that loads its options only has to hand them over.
 */
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

  // Read once, on mount. A remembered value only counts when it is a list for a
  // multi-value variable, or a single value otherwise.
  const cache = useCache();
  const [rememberedValue] = React.useState(() => {
    const remembered = input.rememberValue
      ? cache.get<T>(input.name)
      : undefined;

    return remembered !== undefined && Array.isArray(remembered) === isMulti
      ? remembered
      : undefined;
  });
  const startValue = rememberedValue ?? input.value;

  const [options, setOptions] = React.useState<VariableValueOption[]>(
    () => input.options ?? [],
  );
  // A value in the URL wins over the one the variable was given
  const [value, setValue] = React.useState<T>(() =>
    urlValue === undefined
      ? startValue
      : (fromUrlValue(urlValue, options) as T),
  );

  const [loading, setLoading] = React.useState(
    () => input.loading ?? !hasValue(value),
  );
  const [error, setError] = React.useState<Error | null>(null);

  // Pick up a change to the URL made from outside, like the back button. It is
  // set while rendering, so that the new value never shows up a render late.
  const [syncedUrlValue, setSyncedUrlValue] = React.useState(urlValue);

  if (!sameUrlValue(urlValue, syncedUrlValue)) {
    setSyncedUrlValue(urlValue);

    if (!sameUrlValue(urlValue, toUrlValue(value))) {
      // A parameter that is gone puts the variable back to where it started
      setValue(
        urlValue === undefined
          ? startValue
          : (fromUrlValue(urlValue, options) as T),
      );
    }
  }

  // Remember every value that holds something, whether it came from the user,
  // the URL or options resolving
  const { rememberValue, name } = input;
  React.useEffect(() => {
    if (rememberValue && hasValue(value)) {
      cache.set<T>(name, value);
    }
  }, [cache, name, rememberValue, value]);

  // The latest value, for `onOptionsChange` to check. `onChange` sets it right
  // away, so options handed over in the same event check the new value.
  const valueRef = React.useRef(value);
  React.useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const onChange = React.useCallback(
    (newValue: T) => {
      valueRef.current = newValue;
      setValue(newValue);
      updateUrlState({ [urlKey]: toUrlValue(newValue) } as Record<
        string,
        UrlValue
      >);
    },
    [updateUrlState, urlKey],
  );

  const onOptionsChange = React.useCallback(
    (newOptions: VariableValueOption[]) => {
      setOptions(newOptions);
      setLoading(false);

      const current = valueRef.current;
      const validated = validateValue(current, newOptions) as T;

      if (sameValue(validated, current)) {
        return;
      }

      if (sameUrlValue(toUrlValue(validated), toUrlValue(current))) {
        // Only the labels changed, so the URL stays as it is
        valueRef.current = validated;
        setValue(validated);
        return;
      }

      onChange(validated);
    },
    [onChange],
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
      onOptionsChange,
      onSetLoading: setLoading,
      onSetError: setError,
      parent: input.parent,
    }),
    [
      input.name,
      value,
      loading,
      error,
      options,
      onChange,
      onOptionsChange,
      input.parent,
    ],
  );
}

/**
 * Whether the value holds something: a value that is set, or a list with one.
 */
export function hasValue(value: VariableValueOrValues) {
  if (Array.isArray(value)) {
    return value.some(hasValue);
  }

  return value.value != undefined;
}

/**
 * Keeps the current value when it is one of the options, with the option's
 * label, otherwise picks the first option. A list keeps the values that are
 * options, and gets the first option when none are. With no options, the value
 * is cleared.
 */
function validateValue(
  current: VariableValueOrValues,
  options: VariableValueOption[],
): VariableValueOrValues {
  const findOption = (item: VariableValue) =>
    options.find((option) => String(option.value) === String(item.value));
  const first = options[0];

  if (Array.isArray(current)) {
    const kept = current.flatMap((item) => {
      const option = findOption(item);
      return option ? [toValue(option)] : [];
    });

    if (kept.length > 0 || !first) {
      return kept;
    }

    return [toValue(first)];
  }

  const selected = findOption(current) ?? first;

  return selected ? toValue(selected) : { value: undefined, label: undefined };
}

function toValue(option: VariableValueOption): VariableValue {
  return { value: option.value, label: option.label };
}

function sameValue(a: VariableValueOrValues, b: VariableValueOrValues) {
  const pairs = (value: VariableValueOrValues) =>
    JSON.stringify(
      (Array.isArray(value) ? value : [value]).map((item) => [
        item.value,
        item.label,
      ]),
    );

  return Array.isArray(a) === Array.isArray(b) && pairs(a) === pairs(b);
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
