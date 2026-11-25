import { css, cx } from '@emotion/css';
import { FloatingPortal } from '@floating-ui/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import type { GrafanaTheme2 } from '@grafana/data';
import { Button, Spinner, useStyles2 } from '@grafana/ui';

import { useAdhocFilters } from '../hooks/useAdhocFilters';
import { DropdownItem, PlaceholderItem } from './DropdownItem';
import {
  ERROR_MENU_WIDTH,
  estimateMenuWidth,
  estimateTextWidth,
  getDropdownItems,
  ITEM_HEIGHT,
  ITEM_HEIGHT_WITH_DESCRIPTION,
} from './editorOptions';
import {
  buildFilter,
  editorReducer,
  type EditorOption,
  type EditorState,
  initEditorState,
  isFilterChanged,
} from './editorState';
import {
  expressionToFilter,
  type FilterExpression,
  formatFilterExpression,
  getFilterExpression,
} from './filterExpression';
import {
  type AdHocFilterWithLabels,
  isMultiValueOperator,
  OPERATORS,
} from './filterModel';
import { MultiValuePill } from './MultiValuePill';
import { useAdHocFilterOptions } from './useAdHocFilterOptions';
import { useFloatingInteractions } from './useFloatingInteractions';

export const DEFAULT_FILTER_PLACEHOLDER = '+ label = value';

/** Where focus goes when an edit ends: the filter's pill, the "add filter" input, or nowhere. */
export type AdHocFilterEditorFocusTarget = 'pill' | 'add-input' | 'none';

export interface AdHocFilterEditorHandle {
  /** Focuses the input, opening the dropdown when `open` is set. */
  focus(options?: { open?: boolean }): void;
}

export interface AdHocFilterEditorProps {
  /**
   * The filter being edited. Omit for the always-present "add filter" input,
   * which adds a filter each time a value is picked and then starts over.
   */
  filter?: AdHocFilterWithLabels;
  /** Edit mode: pre-fill the input with the current value, as when the pill is clicked. */
  populateInput?: boolean;
  /** Edit mode: the last filter commits by moving focus to the "add filter" input. */
  isLastFilter?: boolean;
  /** Edit mode: the edit is over, and focus should move to `focusTarget`. */
  onDone?: (focusTarget: AdHocFilterEditorFocusTarget) => void;
  /** Add mode: Backspace in the empty input, to step back into the previous filter. */
  onBackspaceEmpty?: () => void;
  /** Input placeholder before a key is picked. */
  placeholder?: string;
  /** Offer typed text as a key or value even when the data source didn't return it. */
  allowCustomValue?: boolean;
  ref?: React.Ref<AdHocFilterEditorHandle>;
}

/**
 * A single input that steps through key, operator, and value for one filter,
 * with a keyboard-navigable dropdown for each step. Picking a key opens the
 * operators, and picking an operator opens the values. Multi-value operators
 * (`=|`, `!=|`) collect several values and commit them together.
 */
export function AdHocFilterEditor({
  filter,
  populateInput = false,
  isLastFilter = false,
  onDone,
  onBackspaceEmpty,
  placeholder = DEFAULT_FILTER_PLACEHOLDER,
  allowCustomValue = true,
  ref,
}: AdHocFilterEditorProps) {
  const isEditMode = filter != null;
  const styles = useStyles2(getStyles);
  const { onAddFilter, onUpdateFilter, onRemoveFilter } = useAdhocFilters();

  const [state, dispatch] = useReducer(
    editorReducer,
    { filter, populateInput },
    initEditorState,
  );
  const { step, draft, inputValue, open, multiValues } = state;
  const isMultiValueEdit =
    step === 'value' && isMultiValueOperator(draft.operator);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<Array<HTMLElement | null>>([]);

  const { options, loading, fetching, error, retry } = useAdHocFilterOptions({
    step,
    enabled: open,
    key: draft.key,
    editedKey: filter?.key,
  });

  const operatorDefinition = OPERATORS.find(
    (op) => op.value === draft.operator,
  );
  // Typed text like `env = prod` replaces the options with an "apply" hint.
  const expression = useMemo(
    () =>
      getFilterExpression({
        inputValue,
        step,
        draft,
        allowCustomValue,
        populateInput,
      }),
    [inputValue, step, draft, allowCustomValue, populateInput],
  );

  const items = useMemo(
    () =>
      expression
        ? []
        : getDropdownItems({
            options,
            step,
            inputValue,
            preventFiltering: state.preventFiltering,
            allowCustomValue,
            customValueFirst: step === 'value' && !!operatorDefinition?.isRegex,
          }),
    [
      expression,
      options,
      step,
      inputValue,
      state.preventFiltering,
      allowCustomValue,
      operatorDefinition?.isRegex,
    ],
  );

  const activeIndex = resolveActiveIndex(state.activeIndex, items.length);

  // useListNavigation reads the slot count to know where the list ends.
  useLayoutEffect(() => {
    listRef.current.length = items.length;
  }, [items.length]);

  //
  // Committing
  //

  /** Edit mode: saves the edited filter (or removes it once its key is gone) and leaves edit mode. */
  const finishEdit = (
    current: EditorState,
    focusTarget: AdHocFilterEditorFocusTarget,
  ) => {
    if (!filter) {
      return;
    }

    if (!current.draft.key) {
      onRemoveFilter(filter);
      onDone?.('add-input');
      return;
    }

    const complete = buildFilter(current);
    if (complete && isFilterChanged(filter, complete)) {
      onUpdateFilter(filter, complete);
    }

    onDone?.(focusTarget);
  };

  /**
   * Saves a finished filter. Edit mode updates the filter and ends the edit;
   * add mode adds it and starts over on the keys, still open.
   */
  const commitFilter = (
    complete: AdHocFilterWithLabels,
    editFocusTarget: AdHocFilterEditorFocusTarget,
  ) => {
    if (filter) {
      onUpdateFilter(filter, complete);
      onDone?.(editFocusTarget);
      return;
    }

    onAddFilter(complete);
    dispatch({ type: 'reset', open: true });
  };

  /** Commits a full expression, or moves on to the value for one without a value. */
  const applyExpression = (current: FilterExpression) => {
    const complete = expressionToFilter(current);

    if (complete) {
      commitFilter(complete, isLastFilter ? 'add-input' : 'pill');
      return;
    }

    dispatch({
      type: 'applyExpression',
      key: current.key,
      keyLabel: current.keyLabel,
      operator: current.operator,
    });
  };

  /** Add mode: adds the multi values picked so far as a new filter. */
  const addMultiValueFilter = () => {
    const complete = buildFilter(state);
    if (complete) {
      onAddFilter(complete);
    }
  };

  /** Escape, outside press, Tab away, or Apply. */
  const dismiss = (focusTarget: AdHocFilterEditorFocusTarget) => {
    if (isEditMode) {
      finishEdit(state, focusTarget);
      return;
    }

    if (isMultiValueEdit) {
      addMultiValueFilter();
    }

    dispatch({ type: 'reset', open: false });
  };

  const selectItem = (item: EditorOption) => {
    switch (step) {
      case 'key':
        dispatch({ type: 'selectKey', option: item });
        break;

      case 'operator':
        dispatch({
          type: 'selectOperator',
          operator: item.value,
          populateInput,
        });
        break;

      case 'value': {
        if (isMultiValueEdit) {
          dispatch({ type: 'toggleMultiValue', option: item });
          break;
        }

        const complete = buildFilter(state, item);
        if (!complete) {
          break;
        }

        commitFilter(complete, isLastFilter ? 'add-input' : 'pill');
        if (filter) {
          // This editor unmounts, so leave focus where onDone puts it.
          return;
        }
        break;
      }
    }

    inputRef.current?.focus();
  };

  //
  // Floating dropdown
  //

  const isInside = useCallback(
    (target: EventTarget | null) =>
      target instanceof Node && (rootRef.current?.contains(target) ?? false),
    [],
  );

  const {
    refs,
    floatingStyles,
    getReferenceProps,
    getFloatingProps,
    getItemProps,
  } = useFloatingInteractions({
    open,
    onOpenChange: (nextOpen, _event, reason) => {
      if (nextOpen) {
        dispatch({ type: 'open' });
      } else if (reason === 'escape-key') {
        dismiss('pill');
      } else if (reason === 'outside-press') {
        dismiss('none');
      } else if (!isEditMode) {
        // Edit mode only ends on an explicit dismiss.
        dispatch({ type: 'close' });
      }
    },
    activeIndex,
    onNavigate: (index) => dispatch({ type: 'navigate', index }),
    listRef,
    isInside,
  });

  const { setReference, setPositionReference } = refs;

  const setRootRef = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      // Line the dropdown up with the start of the filter, not the input.
      setPositionReference(node);
    },
    [setPositionReference],
  );

  const setInputRef = useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      setReference(node);
    },
    [setReference],
  );

  const estimateSize = useCallback(
    (index: number) =>
      items[index]?.description ? ITEM_HEIGHT_WITH_DESCRIPTION : ITEM_HEIGHT,
    [items],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan: 5,
  });

  // Keep the highlighted row in view while arrowing past the rendered range.
  useLayoutEffect(() => {
    const range = rowVirtualizer.range;
    if (
      open &&
      activeIndex != null &&
      range &&
      (activeIndex > range.endIndex || activeIndex < range.startIndex)
    ) {
      rowVirtualizer.scrollToIndex(activeIndex);
    }
  }, [activeIndex, open, rowVirtualizer]);

  //
  // Focus
  //

  useImperativeHandle(
    ref,
    () => ({
      focus(options) {
        inputRef.current?.focus();
        if (options?.open) {
          dispatch({ type: 'open' });
        }
      },
    }),
    [],
  );

  // An editor for an existing filter mounts when its pill is opened.
  useEffect(() => {
    if (!isEditMode) {
      return;
    }

    inputRef.current?.focus();
    if (populateInput) {
      inputRef.current?.select();
    }
  }, [isEditMode, populateInput]);

  //
  // Keyboard
  //

  const handleBackspace = (event: React.KeyboardEvent) => {
    if (inputValue !== '') {
      return;
    }

    if (step === 'value') {
      if (isMultiValueEdit && multiValues.length) {
        dispatch({ type: 'removeLastMultiValue' });
      } else {
        dispatch({ type: 'editOperator' });
      }
      return;
    }

    if (step === 'operator') {
      event.preventDefault();
      dispatch({ type: 'backToKey' });
      return;
    }

    // Key step with nothing typed: remove this filter, or step back into the previous one.
    if (filter) {
      onRemoveFilter(filter);
      onDone?.('add-input');
    } else {
      dispatch({ type: 'close' });
      onBackspaceEmpty?.();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Tab') {
      const complete = expression && expressionToFilter(expression);

      if (complete && filter) {
        event.preventDefault();
        commitFilter(complete, 'pill');
      } else if (complete) {
        // Add the filter and let Tab move focus on.
        onAddFilter(complete);
        dispatch({ type: 'reset', open: false });
      } else if (isEditMode) {
        // Hand focus back to the pill rather than leaving it on an unmounted input.
        event.preventDefault();
        dismiss('pill');
      } else if (open) {
        dismiss('none');
      }
      return;
    }

    if (event.key === 'Backspace') {
      handleBackspace(event);
      return;
    }

    if (!open) {
      dispatch({ type: 'open' });
      return;
    }

    if (event.key === 'Enter' && expression) {
      event.preventDefault();
      applyExpression(expression);
      return;
    }

    if (event.key === 'Enter' && activeIndex != null) {
      const item = items[activeIndex];
      if (item) {
        event.preventDefault();
        selectItem(item);
      }
    }
  };

  //
  // Render
  //

  const expressionHint = expression
    ? `Press Enter to apply: ${formatFilterExpression(expression)}`
    : undefined;
  const menuWidth = getMenuWidth(items, error, expressionHint);
  const keyLabel = draft.keyLabel ?? draft.key;

  return (
    <div ref={setRootRef} className={styles.root}>
      {step !== 'key' && keyLabel ? (
        <div className={cx(styles.segment, styles.keySegment)}>{keyLabel}</div>
      ) : null}

      {step === 'value' && draft.operator ? (
        <div
          className={cx(styles.segment, styles.operatorSegment)}
          role="button"
          tabIndex={0}
          aria-label="Edit filter operator"
          onClick={(event) => {
            event.stopPropagation();
            dispatch({ type: 'editOperator' });
            inputRef.current?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              dispatch({ type: 'editOperator' });
              inputRef.current?.focus();
            }
          }}
        >
          {draft.operator}
        </div>
      ) : null}

      {isMultiValueEdit
        ? multiValues.map((item) => (
            <MultiValuePill
              key={item.value}
              item={item}
              onRemove={(removed) => {
                dispatch({ type: 'removeMultiValue', value: removed.value });
                inputRef.current?.focus();
              }}
              onEdit={(edited) => {
                dispatch({ type: 'editMultiValue', option: edited });
                inputRef.current?.focus();
                // Select once the new value has rendered into the input.
                requestAnimationFrame(() => inputRef.current?.select());
              }}
            />
          ))
        : null}

      <input
        {...getReferenceProps({
          ref: setInputRef,
          value: inputValue,
          placeholder: getPlaceholder(state, isEditMode, placeholder),
          'aria-autocomplete': 'list',
          'aria-label': getInputLabel(state),
          onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
            dispatch({ type: 'inputChange', value: event.target.value }),
          onKeyDown: handleKeyDown,
          onClick: (event: React.MouseEvent) => {
            event.stopPropagation();
            dispatch({ type: 'open' });
          },
        })}
        className={styles.input}
      />

      {fetching ? <Spinner className={styles.spinner} inline /> : null}

      <FloatingPortal>
        {open ? (
          <div
            ref={refs.setFloating}
            className={styles.menu}
            style={{ ...floatingStyles, width: menuWidth }}
            // Keep focus in the input while clicking rows and buttons.
            onMouseDown={(event) => event.preventDefault()}
          >
            <div ref={scrollRef} className={styles.scroller}>
              <div
                {...getFloatingProps()}
                style={{
                  position: 'relative',
                  height: rowVirtualizer.getTotalSize() || undefined,
                }}
              >
                {renderMenuContent()}
              </div>
            </div>

            {isMultiValueEdit && !loading && !error && items.length ? (
              <div className={styles.menuFooter}>
                <Button size="sm" tabIndex={-1} onClick={() => dismiss('pill')}>
                  Apply
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </FloatingPortal>
    </div>
  );

  function renderMenuContent() {
    if (loading) {
      return <PlaceholderItem>Loading options...</PlaceholderItem>;
    }

    if (error) {
      return (
        <DropdownItem nonInteractive className={styles.retry} onClick={retry}>
          An error has occurred fetching labels. Click to retry
        </DropdownItem>
      );
    }

    if (expressionHint) {
      return <PlaceholderItem>{expressionHint}</PlaceholderItem>;
    }

    if (!items.length) {
      return <PlaceholderItem>No options found</PlaceholderItem>;
    }

    return rowVirtualizer.getVirtualItems().map((virtualItem) => {
      const index = virtualItem.index;
      const item = items[index];

      return (
        <DropdownItem
          key={`${item.isCustom ? 'custom' : 'option'}-${item.value}`}
          {...getItemProps({
            ref(node: HTMLElement | null) {
              listRef.current[index] = node;
            },
            onClick(event: React.MouseEvent) {
              // Stops the label wrapping the checkbox from firing a second click.
              event.preventDefault();
              selectItem(item);
            },
          })}
          active={activeIndex === index}
          checkable={isMultiValueEdit}
          checked={multiValues.some((value) => value.value === item.value)}
          aria-setsize={items.length}
          aria-posinset={index + 1}
          style={{
            height: virtualItem.size,
            transform: `translateY(${virtualItem.start}px)`,
          }}
        >
          <span>
            {item.isCustom ? `Use custom value: ${item.label}` : item.label}
            {item.description ? (
              <div className={styles.description}>{item.description}</div>
            ) : null}
          </span>
        </DropdownItem>
      );
    });
  }
}

function getMenuWidth(
  items: EditorOption[],
  error: boolean,
  hint: string | undefined,
): number {
  if (error) {
    return ERROR_MENU_WIDTH;
  }

  const width = estimateMenuWidth(items);
  return hint ? Math.max(width, estimateTextWidth(hint)) : width;
}

/** The highlighted row, defaulting to the first one when nothing (or an out-of-range row) is set. */
function resolveActiveIndex(
  index: number | null,
  count: number,
): number | null {
  if (index != null && index < count) {
    return index;
  }

  return count > 0 ? 0 : null;
}

function getPlaceholder(
  state: EditorState,
  isEditMode: boolean,
  defaultPlaceholder: string,
): string {
  switch (state.step) {
    case 'key':
      return defaultPlaceholder;
    case 'operator':
      return isEditMode ? (state.draft.operator ?? '') : '';
    case 'value':
      if (isMultiValueOperator(state.draft.operator)) {
        return 'Edit values';
      }
      return state.draft.valueLabel ?? '';
  }
}

function getInputLabel(state: EditorState): string {
  switch (state.step) {
    case 'key':
      return 'Filter label';
    case 'operator':
      return 'Filter operator';
    case 'value':
      return 'Filter value';
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  root: css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
  }),
  segment: css({
    display: 'flex',
    alignItems: 'center',
    background: theme.colors.action.disabledBackground,
    border: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(0.125, 1),
    color: theme.colors.text.primary,
    whiteSpace: 'nowrap',
    minHeight: theme.spacing(2.75),
    ...theme.typography.bodySmall,
  }),
  keySegment: css({
    fontWeight: theme.typography.fontWeightBold,
    cursor: 'default',
  }),
  operatorSegment: css({
    cursor: 'pointer',
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  input: css({
    ...theme.typography.bodySmall,
    background: 'transparent',
    border: 'none',
    color: theme.colors.text.primary,
    paddingBlock: 0,
    paddingInline: theme.spacing(0.5),
    width: '90px',
    minWidth: '90px',
    maxWidth: '200px',
    '@supports (field-sizing: content)': {
      width: 'auto',
      minWidth: '90px',
      fieldSizing: 'content',
    },
    '&::placeholder': {
      color: theme.colors.text.secondary,
    },
    '&:focus': {
      outline: 'none',
    },
  }),
  spinner: css({
    display: 'flex',
    alignItems: 'center',
    color: theme.colors.text.secondary,
    marginLeft: theme.spacing(0.5),
  }),
  menu: css({
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.colors.background.elevated,
    color: theme.colors.text.primary,
    boxShadow: theme.shadows.z2,
    borderRadius: theme.shape.radius.default,
    zIndex: theme.zIndex.portal,
    overflow: 'hidden',
    ...theme.typography.bodySmall,
  }),
  scroller: css({
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
  }),
  menuFooter: css({
    display: 'flex',
    flexShrink: 0,
    padding: theme.spacing(1),
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
  description: css({
    color: theme.colors.text.secondary,
    paddingTop: theme.spacing(0.5),
  }),
  retry: css({
    cursor: 'pointer',
    whiteSpace: 'normal',
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
});
