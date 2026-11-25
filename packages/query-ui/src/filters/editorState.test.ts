import { describe, expect, it } from 'vitest';

import { getDropdownItems, searchOptions } from './editorOptions';
import {
  buildFilter,
  type EditorAction,
  editorReducer,
  type EditorState,
  initEditorState,
} from './editorState';
import type { AdHocFilterWithLabels } from './filterModel';

function run(state: EditorState, ...actions: EditorAction[]): EditorState {
  return actions.reduce(editorReducer, state);
}

const service = { value: 'service', label: 'service' };
const checkout = { value: 'checkout', label: 'checkout' };
const cart = { value: 'cart', label: 'cart' };

describe('editorReducer', () => {
  it('steps from key to operator to value, clearing the input each time', () => {
    const state = run(
      initEditorState({}),
      { type: 'inputChange', value: 'serv' },
      { type: 'selectKey', option: service },
    );

    expect(state.step).toBe('operator');
    expect(state.inputValue).toBe('');
    expect(state.draft).toEqual({ key: 'service', keyLabel: 'service' });

    const next = editorReducer(state, {
      type: 'selectOperator',
      operator: '=',
      populateInput: false,
    });

    expect(next.step).toBe('value');
    expect(next.draft.operator).toBe('=');
    expect(buildFilter(next, checkout)).toEqual({
      key: 'service',
      keyLabel: 'service',
      operator: '=',
      value: 'checkout',
      valueLabels: ['checkout'],
      values: undefined,
    });
  });

  it('collects multi values and commits them together', () => {
    const state = run(
      initEditorState({}),
      { type: 'selectKey', option: service },
      { type: 'selectOperator', operator: '=|', populateInput: false },
      { type: 'toggleMultiValue', option: checkout },
      { type: 'toggleMultiValue', option: cart },
    );

    expect(buildFilter(state)).toEqual({
      key: 'service',
      keyLabel: 'service',
      operator: '=|',
      value: 'checkout',
      values: ['checkout', 'cart'],
      valueLabels: ['checkout', 'cart'],
    });

    const toggledOff = editorReducer(state, {
      type: 'toggleMultiValue',
      option: checkout,
    });
    expect(toggledOff.multiValues).toEqual([cart]);
  });

  it('has nothing to commit for a multi-value operator without values', () => {
    const state = run(
      initEditorState({}),
      { type: 'selectKey', option: service },
      { type: 'selectOperator', operator: '=|', populateInput: false },
    );

    expect(buildFilter(state)).toBeUndefined();
  });

  it('carries the single value over when switching to a multi-value operator', () => {
    const filter: AdHocFilterWithLabels = {
      key: 'service',
      operator: '=',
      value: 'checkout',
    };
    const state = run(
      initEditorState({ filter }),
      { type: 'editOperator' },
      { type: 'selectOperator', operator: '=|', populateInput: true },
    );

    expect(state.multiValues).toEqual([checkout]);
    expect(state.inputValue).toBe('');
  });

  it('keeps the first value when switching from a multi-value operator', () => {
    const filter: AdHocFilterWithLabels = {
      key: 'service',
      operator: '=|',
      value: 'checkout',
      values: ['checkout', 'cart'],
      valueLabels: ['Checkout', 'Cart'],
    };
    const state = run(
      initEditorState({ filter }),
      { type: 'editOperator' },
      { type: 'selectOperator', operator: '!=', populateInput: true },
    );

    expect(state.multiValues).toEqual([]);
    expect(state.inputValue).toBe('Checkout');
    expect(buildFilter(state)).toMatchObject({
      operator: '!=',
      value: 'checkout',
      valueLabels: ['Checkout'],
      values: undefined,
    });
  });

  it('opens an existing filter on its value, pre-filled when asked', () => {
    const filter: AdHocFilterWithLabels = {
      key: 'env',
      operator: '=',
      value: 'prod',
      valueLabels: ['Production'],
    };

    const populated = initEditorState({ filter, populateInput: true });
    expect(populated).toMatchObject({
      step: 'value',
      open: true,
      inputValue: 'Production',
      preventFiltering: true,
    });

    const empty = initEditorState({ filter, populateInput: false });
    expect(empty.inputValue).toBe('');
    expect(empty.preventFiltering).toBe(false);
  });

  it('steps back to the key and forgets the draft', () => {
    const state = run(
      initEditorState({}),
      { type: 'selectKey', option: service },
      { type: 'backToKey' },
    );

    expect(state.step).toBe('key');
    expect(state.draft).toEqual({});
  });

  it('moves a multi value back into the input to edit it', () => {
    const state = run(
      initEditorState({}),
      { type: 'selectKey', option: service },
      { type: 'selectOperator', operator: '=|', populateInput: false },
      { type: 'toggleMultiValue', option: checkout },
      { type: 'toggleMultiValue', option: cart },
      { type: 'editMultiValue', option: checkout },
    );

    expect(state.multiValues).toEqual([cart]);
    expect(state.inputValue).toBe('checkout');
    expect(state.preventFiltering).toBe(true);
  });

  it('applies a typed key and operator, moving on to the value', () => {
    const state = run(
      initEditorState({}),
      { type: 'inputChange', value: 'env !=' },
      { type: 'applyExpression', key: 'env', keyLabel: 'env', operator: '!=' },
    );

    expect(state).toMatchObject({
      step: 'value',
      draft: { key: 'env', keyLabel: 'env', operator: '!=' },
      inputValue: '',
      multiValues: [],
    });
  });

  it('keeps the value when an expression only changes the operator', () => {
    const filter: AdHocFilterWithLabels = {
      key: 'service',
      operator: '=',
      value: 'checkout',
    };
    const state = run(
      initEditorState({ filter }),
      { type: 'editOperator' },
      {
        type: 'applyExpression',
        key: 'service',
        keyLabel: 'service',
        operator: '=|',
      },
    );

    expect(state.multiValues).toEqual([checkout]);
  });

  it('drops the value when an expression picks a different key', () => {
    const filter: AdHocFilterWithLabels = {
      key: 'service',
      operator: '=',
      value: 'checkout',
    };
    const state = run(
      initEditorState({ filter }),
      { type: 'editOperator' },
      { type: 'backToKey' },
      { type: 'applyExpression', key: 'env', keyLabel: 'env', operator: '=' },
    );

    expect(state.draft).toEqual({ key: 'env', keyLabel: 'env', operator: '=' });
    expect(buildFilter(state)).toBeUndefined();
  });

  it('starts over after a reset, keeping the requested open state', () => {
    const state = run(
      initEditorState({}),
      { type: 'selectKey', option: service },
      { type: 'reset', open: true },
    );

    expect(state).toEqual({ ...initEditorState({}), open: true });
  });
});

describe('getDropdownItems', () => {
  const options = [
    { value: 'us-east', label: 'us-east' },
    { value: 'eu', label: 'eu' },
    { value: 'europe', label: 'europe' },
  ];

  it('ranks exact and prefix matches first', () => {
    expect(searchOptions(options, 'eu').map((o) => o.value)).toEqual([
      'eu',
      'europe',
    ]);
    expect(searchOptions(options, 'east').map((o) => o.value)).toEqual([
      'us-east',
    ]);
  });

  it('offers typed text as a custom value unless it matches exactly', () => {
    const base = {
      options,
      step: 'value' as const,
      preventFiltering: false,
      allowCustomValue: true,
      customValueFirst: false,
    };

    expect(getDropdownItems({ ...base, inputValue: 'eur' }).at(-1)).toEqual({
      value: 'eur',
      label: 'eur',
      isCustom: true,
    });
    expect(
      getDropdownItems({ ...base, inputValue: 'eu' }).some((o) => o.isCustom),
    ).toBe(false);
    expect(
      getDropdownItems({
        ...base,
        inputValue: 'eur',
        customValueFirst: true,
      })[0].isCustom,
    ).toBe(true);
  });

  it('lists everything while filtering is held off', () => {
    expect(
      getDropdownItems({
        options,
        step: 'value',
        inputValue: 'eu',
        preventFiltering: true,
        allowCustomValue: true,
        customValueFirst: false,
      }),
    ).toHaveLength(3);
  });
});
