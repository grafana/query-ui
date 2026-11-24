import { isArray } from 'lodash';
import { Combobox, type ComboboxOption, Field } from '@grafana/ui';

import { useVariable } from '../../hooks/useVariable';
import type {
  VariableContextState,
  VariableValue,
  VariableValueOption,
} from '../../variables/types';

interface VariableValueComboboxProps {
  name: string;
  /** Lets the user enter a value that is not one of the options. */
  allowCustomValue?: boolean;
}

export function VariableValueCombobox({
  name,
  allowCustomValue = false,
}: VariableValueComboboxProps) {
  const variable = useVariable<VariableValue>(name);
  const { loadOptions } = variable;
  // Loaded when the combobox opens and as the user types, if the variable supports it
  const options = loadOptions
    ? (search: string) => loadOptions(search).then(toComboboxOptions)
    : toComboboxOptions(variable.options ?? []);

  const onChange = (newValue: ComboboxOption<string>) => {
    variable.onChange({
      value: newValue.value,
      label: newValue.label ?? newValue.value,
    });
  };

  const value = getComboboxValue(variable);

  return (
    <Field label={name} noMargin>
      <Combobox
        id={`variable-${name}`}
        loading={variable.loading}
        value={value}
        options={options}
        width="auto"
        minWidth={20}
        createCustomValue={allowCustomValue}
        onChange={onChange}
      />
    </Field>
  );
}

function getComboboxValue(variable: VariableContextState<VariableValue>) {
  if (isArray(variable.value)) {
    throw new Error(
      'VariableValueCombobox does not support multi-value variables',
    );
  }

  const { value, label } = variable.value;
  if (value === undefined || value === '') {
    return null;
  }

  // An option rather than a plain value, so the label shows before any options load
  return { value: String(value), label: label ?? String(value) };
}

export function toComboboxOptions(
  options: VariableValueOption[],
): Array<ComboboxOption<string>> {
  return options.map((x) => ({
    value: String(x.value),
    label: x.label ?? String(x.value),
  }));
}
