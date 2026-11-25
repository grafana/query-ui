import { isArray } from 'lodash';
import { type ComboboxOption, Field, MultiCombobox } from '@grafana/ui';

import { useVariable } from '../../hooks/useVariable';
import type {
  VariableContextState,
  VariableValue,
} from '../../variables/types';
import { toComboboxOptions } from '../VariableValueCombobox/VariableValueCombobox';

interface VariableValueMultiComboboxProps {
  name: string;
}

export function VariableValueMultiCombobox({
  name,
}: VariableValueMultiComboboxProps) {
  const variable = useVariable<VariableValue[]>(name);
  const { loadOptions } = variable;
  // Loaded when the combobox opens and as the user types, if the variable supports it
  const options = loadOptions
    ? (search: string) => loadOptions(search).then(toComboboxOptions)
    : toComboboxOptions(variable.options ?? []);

  const onChange = (newValues: Array<ComboboxOption<string>>) => {
    variable.onChange(
      newValues.map((x) => ({
        value: x.value,
        label: x.label ?? x.value,
      })),
    );
  };

  const value = getMultiComboboxValue(variable);

  return (
    <Field label={name} noMargin>
      <MultiCombobox
        id={`variable-${name}`}
        loading={variable.loading}
        value={value}
        options={options}
        width="auto"
        minWidth={45}
        onChange={onChange}
      />
    </Field>
  );
}

function getMultiComboboxValue(
  variable: VariableContextState<VariableValue[]>,
) {
  if (!isArray(variable.value)) {
    throw new Error(
      'VariableValueMultiCombobox only supports multi-value variables',
    );
  }

  // Options rather than plain values, so the labels show before any options load
  return variable.value
    .filter((x) => x.value !== undefined)
    .map((x) => ({
      value: String(x.value),
      label: x.label ?? String(x.value),
    }));
}
