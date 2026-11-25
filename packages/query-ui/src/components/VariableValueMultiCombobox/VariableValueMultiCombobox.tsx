import { isArray } from 'lodash';
import { useCallback, useMemo } from 'react';
import { type ComboboxOption, Field, MultiCombobox } from '@grafana/ui';

import { useVariable } from '../../hooks/useVariable';
import type { VariableValue } from '../../variables/types';
import { toComboboxOptions } from '../VariableValueCombobox/VariableValueCombobox';

interface VariableValueMultiComboboxProps {
  name: string;
  /** Lets the user enter values that are not options. */
  allowCustomValue?: boolean;
}

export function VariableValueMultiCombobox({
  name,
  allowCustomValue = false,
}: VariableValueMultiComboboxProps) {
  const variable = useVariable<VariableValue[]>(name);
  const { value, loadOptions, options, onChange } = variable;

  // Loaded when the combobox opens and as the user types, if the variable supports it
  const comboboxOptions = useMemo(
    () =>
      loadOptions
        ? (search: string) => loadOptions(search).then(toComboboxOptions)
        : toComboboxOptions(options ?? []),
    [loadOptions, options],
  );

  const comboboxOnChange = useCallback(
    (newValues: Array<ComboboxOption<string>>) => {
      onChange(
        newValues.map((x) => ({
          value: x.value,
          label: x.label ?? x.value,
        })),
      );
    },
    [onChange],
  );

  const comboboxValue = useMemo(() => getMultiComboboxValue(value), [value]);

  return (
    <Field label={name} noMargin>
      <MultiCombobox
        id={`variable-${name}`}
        loading={variable.loading}
        value={comboboxValue}
        options={comboboxOptions}
        width="auto"
        minWidth={45}
        createCustomValue={allowCustomValue}
        onChange={comboboxOnChange}
      />
    </Field>
  );
}

function getMultiComboboxValue(value: VariableValue[]) {
  if (!isArray(value)) {
    throw new Error(
      'VariableValueMultiCombobox only supports multi-value variables',
    );
  }

  // Options rather than plain values, so the labels show before any options load
  return value
    .filter((x) => x.value !== undefined)
    .map((x) => ({
      value: String(x.value),
      label: x.label ?? String(x.value),
    }));
}
