import { isArray } from 'lodash';
import { useCallback, useMemo } from 'react';
import { Combobox, type ComboboxOption, Field } from '@grafana/ui';

import { useVariable } from '../../hooks/useVariable';
import type { VariableValue, VariableValueOption } from '../../variables/types';

interface VariableValueComboboxProps {
  name: string;
}

export function VariableValueCombobox({ name }: VariableValueComboboxProps) {
  const { value, loadOptions, options, loading, onChange } =
    useVariable<VariableValue>(name);

  const comboboxOptions = useMemo(
    () =>
      loadOptions
        ? (search: string) => loadOptions(search).then(toComboboxOptions)
        : toComboboxOptions(options ?? []),
    [loadOptions, options],
  );

  const comboboxOnChange = useCallback(
    (newValue: ComboboxOption<string>) => {
      onChange({
        value: newValue.value,
        label: newValue.label ?? newValue.value,
      });
    },
    [onChange],
  );

  const comboboxValue = getComboboxValue(value);

  return (
    <Field label={name} noMargin>
      <Combobox
        id={`variable-${name}`}
        loading={loading}
        value={comboboxValue}
        options={comboboxOptions}
        width="auto"
        minWidth={20}
        onChange={comboboxOnChange}
      />
    </Field>
  );
}

function getComboboxValue(value: VariableValue) {
  if (isArray(value.value)) {
    throw new Error(
      'VariableValueCombobox does not support multi-value variables',
    );
  }

  if (value.value === undefined || value.value === '') {
    return null;
  }

  // An option rather than a plain value, so the label shows before any options load
  return {
    value: String(value.value),
    label: value.label ?? String(value.value),
  };
}

export function toComboboxOptions(
  options: VariableValueOption[],
): Array<ComboboxOption<string>> {
  return options.map((x) => ({
    value: String(x.value),
    label: x.label ?? String(x.value),
  }));
}
