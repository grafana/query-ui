import type { EditorStep, FilterDraft } from './editorState';
import {
  type AdHocFilterWithLabels,
  isMultiValueOperator,
  OPERATORS,
} from './filterModel';

export interface ParsedFilterExpression {
  key: string | undefined;
  operator: string;
  value: string;
}

/**
 * Splits typed text like `instance = tempo`, `= tempo`, or `!=` into its
 * parts. Returns null when the text has no operator.
 *
 * Uses the earliest operator in the text. When several start at the same
 * position the longest wins, so `!=|` beats `!=` and `=~` beats `=`.
 */
export function parseFilterExpression(
  input: string,
  operatorValues: string[] = OPERATORS.map((op) => op.value),
): ParsedFilterExpression | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  let matchIndex = -1;
  let matchedOperator = '';

  for (const op of operatorValues) {
    const index = trimmed.indexOf(op);
    if (index === -1) {
      continue;
    }

    if (
      matchIndex === -1 ||
      index < matchIndex ||
      (index === matchIndex && op.length > matchedOperator.length)
    ) {
      matchIndex = index;
      matchedOperator = op;
    }
  }

  if (matchIndex === -1) {
    return null;
  }

  const key = matchIndex > 0 ? trimmed.slice(0, matchIndex).trim() : undefined;
  const value = trimmed.slice(matchIndex + matchedOperator.length).trim();

  return { key, operator: matchedOperator, value };
}

/** A typed expression resolved against the editor state, ready to apply. */
export interface FilterExpression {
  key: string;
  keyLabel: string;
  operator: string;
  /** Empty when only the key and operator were typed. */
  values: string[];
}

export interface FilterExpressionInput {
  inputValue: string;
  step: EditorStep;
  draft: FilterDraft;
  allowCustomValue: boolean;
  /**
   * The editor opened by clicking a pill, with its value in the input. Typing
   * there edits that value, so expressions are off.
   */
  populateInput: boolean;
}

/**
 * The expression typed into the editor, or null when the input isn't one.
 *
 * Expressions work while picking a key (`env = prod`, `env =`) or an operator
 * (`= prod`, `!=`, using the key already picked). While picking a value the
 * text is a value, even if it contains an operator. Multi-value operators
 * take comma-separated values: `env =| prod, dev`.
 */
export function getFilterExpression({
  inputValue,
  step,
  draft,
  allowCustomValue,
  populateInput,
}: FilterExpressionInput): FilterExpression | null {
  if (!allowCustomValue || step === 'value' || populateInput) {
    return null;
  }

  const parsed = parseFilterExpression(inputValue);
  if (!parsed) {
    return null;
  }

  let key = parsed.key;
  let keyLabel = parsed.key;

  if (step === 'operator') {
    // The key is already picked; text before the operator doesn't change it.
    key = draft.key;
    keyLabel = draft.keyLabel ?? draft.key;
  }

  if (!key || !keyLabel) {
    return null;
  }

  return {
    key,
    keyLabel,
    operator: parsed.operator,
    values: splitValues(parsed.operator, parsed.value),
  };
}

function splitValues(operator: string, value: string): string[] {
  if (!value) {
    return [];
  }

  if (!isMultiValueOperator(operator)) {
    return [value];
  }

  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

/** The finished filter for an expression, or undefined when it has no value yet. */
export function expressionToFilter(
  expression: FilterExpression,
): AdHocFilterWithLabels | undefined {
  const { key, keyLabel, operator, values } = expression;

  if (!values.length) {
    return undefined;
  }

  if (isMultiValueOperator(operator)) {
    return {
      key,
      keyLabel,
      operator,
      value: values[0],
      values,
      valueLabels: values,
    };
  }

  return {
    key,
    keyLabel,
    operator,
    value: values[0],
    valueLabels: [values[0]],
    values: undefined,
  };
}

/** The expression as the user would read it back, like `env =| prod, dev`. */
export function formatFilterExpression(expression: FilterExpression): string {
  const head = `${expression.keyLabel} ${expression.operator}`;
  return expression.values.length
    ? `${head} ${expression.values.join(', ')}`
    : head;
}
