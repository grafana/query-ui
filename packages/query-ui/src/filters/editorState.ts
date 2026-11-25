import {
  type AdHocFilterWithLabels,
  isMultiValueOperator,
} from './filterModel';

/** Which part of the filter the input is picking. */
export type EditorStep = 'key' | 'operator' | 'value';

/** One row in the editor dropdown. */
export interface EditorOption {
  value: string;
  label: string;
  description?: string;
  /** Typed by the user rather than returned by the data source. */
  isCustom?: boolean;
}

/** The filter as picked so far. Holds a single value; multi values live in `multiValues`. */
export interface FilterDraft {
  key?: string;
  keyLabel?: string;
  operator?: string;
  value?: string;
  valueLabel?: string;
}

export interface EditorState {
  step: EditorStep;
  draft: FilterDraft;
  inputValue: string;
  open: boolean;
  /** Highlighted dropdown row. `null` highlights the first row. */
  activeIndex: number | null;
  /** Values picked for a multi-value operator. They're committed together. */
  multiValues: EditorOption[];
  /**
   * List every option even though the input has text. Set while the input
   * holds a pre-filled value, and cleared as soon as the user types.
   */
  preventFiltering: boolean;
}

export type EditorAction =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'inputChange'; value: string }
  | { type: 'navigate'; index: number | null }
  | { type: 'selectKey'; option: EditorOption }
  | { type: 'selectOperator'; operator: string; populateInput: boolean }
  | {
      /** A typed `key op` expression without a value: moves on to picking the value. */
      type: 'applyExpression';
      key: string;
      keyLabel: string;
      operator: string;
    }
  | { type: 'editOperator' }
  | { type: 'backToKey' }
  | { type: 'toggleMultiValue'; option: EditorOption }
  | { type: 'removeMultiValue'; value: string }
  | { type: 'removeLastMultiValue' }
  | { type: 'editMultiValue'; option: EditorOption }
  | { type: 'reset'; open: boolean };

export interface EditorInit {
  /** The filter being edited, or undefined for the "add filter" input. */
  filter?: AdHocFilterWithLabels;
  /** Pre-fill the input with the filter's current value. */
  populateInput?: boolean;
}

const EMPTY_STATE: EditorState = {
  step: 'key',
  draft: {},
  inputValue: '',
  open: false,
  activeIndex: null,
  multiValues: [],
  preventFiltering: false,
};

export function initEditorState({
  filter,
  populateInput,
}: EditorInit): EditorState {
  if (!filter) {
    return EMPTY_STATE;
  }

  const isMulti = isMultiValueOperator(filter.operator);
  const valueLabel = filter.valueLabels?.[0] ?? filter.value;
  const inputValue = populateInput && !isMulti ? valueLabel : '';

  return {
    step: 'value',
    draft: {
      key: filter.key,
      keyLabel: filter.keyLabel ?? filter.key,
      operator: filter.operator,
      value: filter.value,
      valueLabel,
    },
    inputValue,
    open: true,
    activeIndex: null,
    multiValues: isMulti ? toMultiValues(filter) : [],
    preventFiltering: inputValue !== '',
  };
}

export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  switch (action.type) {
    case 'open':
      return state.open ? state : { ...state, open: true };

    case 'close':
      return state.open ? { ...state, open: false, activeIndex: null } : state;

    case 'inputChange':
      return {
        ...state,
        inputValue: action.value,
        open: true,
        activeIndex: null,
        preventFiltering: false,
      };

    case 'navigate':
      return { ...state, activeIndex: action.index };

    case 'selectKey':
      return {
        ...state,
        step: 'operator',
        draft: { key: action.option.value, keyLabel: action.option.label },
        multiValues: [],
        ...clearedInput,
      };

    case 'selectOperator':
      return selectOperator(state, action.operator, action.populateInput);

    case 'applyExpression': {
      // Same key: only the operator changed, so keep the value as picking it would.
      const base =
        action.key === state.draft.key
          ? state
          : {
              ...state,
              draft: { key: action.key, keyLabel: action.keyLabel },
              multiValues: [],
            };

      return selectOperator(base, action.operator, false);
    }

    case 'editOperator':
      return { ...state, step: 'operator', ...clearedInput };

    case 'backToKey':
      return {
        ...state,
        step: 'key',
        draft: {},
        multiValues: [],
        ...clearedInput,
      };

    case 'toggleMultiValue': {
      const exists = state.multiValues.some(
        (item) => item.value === action.option.value,
      );

      return {
        ...state,
        multiValues: exists
          ? state.multiValues.filter(
              (item) => item.value !== action.option.value,
            )
          : [...state.multiValues, action.option],
        inputValue: '',
        preventFiltering: false,
        // Clearing typed text changes the list, so the old index means nothing.
        activeIndex: state.inputValue ? null : state.activeIndex,
      };
    }

    case 'removeMultiValue':
      return {
        ...state,
        multiValues: state.multiValues.filter(
          (item) => item.value !== action.value,
        ),
      };

    case 'removeLastMultiValue':
      return { ...state, multiValues: state.multiValues.slice(0, -1) };

    case 'editMultiValue':
      return {
        ...state,
        multiValues: state.multiValues.filter(
          (item) => item.value !== action.option.value,
        ),
        inputValue: action.option.label,
        preventFiltering: true,
        activeIndex: null,
        open: true,
      };

    case 'reset':
      return { ...EMPTY_STATE, open: action.open };
  }
}

const clearedInput = {
  inputValue: '',
  activeIndex: null,
  preventFiltering: false,
} satisfies Partial<EditorState>;

function selectOperator(
  state: EditorState,
  operator: string,
  populateInput: boolean,
): EditorState {
  const wasMulti = isMultiValueOperator(state.draft.operator);
  const isMulti = isMultiValueOperator(operator);
  let { draft, multiValues } = state;

  if (isMulti && !wasMulti) {
    // Carry the single value over as the first of the multi values.
    multiValues =
      draft.value != null && draft.value !== ''
        ? [{ value: draft.value, label: draft.valueLabel ?? draft.value }]
        : [];
  } else if (!isMulti && wasMulti) {
    // Keep the first multi value as the single value.
    const first = multiValues[0];
    draft = { ...draft, value: first?.value, valueLabel: first?.label };
    multiValues = [];
  }

  const inputValue =
    populateInput && !isMulti && draft.valueLabel ? draft.valueLabel : '';

  return {
    ...state,
    step: 'value',
    draft: { ...draft, operator },
    multiValues,
    inputValue,
    activeIndex: null,
    preventFiltering: inputValue !== '',
  };
}

function toMultiValues(filter: AdHocFilterWithLabels): EditorOption[] {
  const values = filter.values ?? (filter.value ? [filter.value] : []);

  return values.map((value, i) => ({
    value,
    label: filter.valueLabels?.[i] ?? value,
  }));
}

/**
 * The finished filter for the current state, or undefined while a part is
 * still missing. Pass `valueOption` to use a just-picked single value instead
 * of the draft's.
 */
export function buildFilter(
  state: EditorState,
  valueOption?: EditorOption,
): AdHocFilterWithLabels | undefined {
  const { key, keyLabel, operator } = state.draft;

  if (!key || !operator) {
    return undefined;
  }

  if (isMultiValueOperator(operator)) {
    if (!state.multiValues.length) {
      return undefined;
    }

    const values = state.multiValues.map((item) => item.value);

    return {
      key,
      keyLabel,
      operator,
      value: values[0],
      values,
      valueLabels: state.multiValues.map((item) => item.label),
    };
  }

  const value = valueOption?.value ?? state.draft.value;

  if (value == null) {
    return undefined;
  }

  return {
    key,
    keyLabel,
    operator,
    value,
    valueLabels: [valueOption?.label ?? state.draft.valueLabel ?? value],
    // Clears `values` left over from a multi-value operator.
    values: undefined,
  };
}

/** True when committing `next` over `prev` would change what the filter matches or shows. */
export function isFilterChanged(
  prev: AdHocFilterWithLabels,
  next: AdHocFilterWithLabels,
): boolean {
  return (
    prev.key !== next.key ||
    prev.operator !== next.operator ||
    prev.value !== next.value ||
    (prev.values ?? []).join('\u0000') !== (next.values ?? []).join('\u0000') ||
    (prev.valueLabels ?? []).join('\u0000') !==
      (next.valueLabels ?? []).join('\u0000')
  );
}
