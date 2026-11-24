import { isArray } from 'lodash';
import { type ComboboxOption, Field, MultiCombobox } from '@grafana/ui';

import { useVariable } from '../../hooks/useVariable';
import type {
  VariableContextState,
  VariableValue,
} from '../../variables/types';

interface VariableValueMultiComboboxProps {
  name: string;
}

export function VariableValueMultiCombobox({
  name,
}: VariableValueMultiComboboxProps) {
  const variable = useVariable<VariableValue[]>(name);
  const options =
    variable.options?.map((x) => ({
      value: String(x.value),
      label: x.label ?? String(x.value),
    })) ?? [];

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
        loading={variable.loading}
        value={value}
        options={options}
        width="auto"
        minWidth={25}
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

  return variable.value
    .filter((x) => x.value !== undefined)
    .map((x) => String(x.value));
}
