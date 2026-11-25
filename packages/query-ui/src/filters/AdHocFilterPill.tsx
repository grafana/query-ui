import { css } from '@emotion/css';
import { useLayoutEffect, useRef } from 'react';
import type { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

import { useAdhocFilters } from '../hooks/useAdhocFilters';
import {
  AdHocFilterEditor,
  type AdHocFilterEditorFocusTarget,
} from './AdHocFilterEditor';
import type { AdHocFilterWithLabels } from './filterModel';

export interface AdHocFilterPillProps {
  filter: AdHocFilterWithLabels;
  /** Show the editor in place of the pill. */
  isEditing: boolean;
  /** Pre-fill the editor input with the current value. */
  populateInput?: boolean;
  isLastFilter: boolean;
  allowCustomValue?: boolean;
  /** Asks to edit this filter; `populateInput` is set when the user opened the pill directly. */
  onStartEdit: (populateInput: boolean) => void;
  onEndEdit: () => void;
  /** Moves focus to the "add filter" input. */
  focusAddInput: () => void;
}

/** A committed filter, shown as a removable "key op value" chip that turns into the editor on click. */
export function AdHocFilterPill({
  filter,
  isEditing,
  populateInput,
  isLastFilter,
  allowCustomValue,
  onStartEdit,
  onEndEdit,
  focusAddInput,
}: AdHocFilterPillProps) {
  const styles = useStyles2(getStyles);
  const { onRemoveFilter } = useAdhocFilters();
  const pillRef = useRef<HTMLDivElement>(null);
  const focusPillOnViewRef = useRef(false);

  // The pill remounts when editing ends; focus it if the editor asked for that.
  useLayoutEffect(() => {
    if (!isEditing && focusPillOnViewRef.current) {
      focusPillOnViewRef.current = false;
      pillRef.current?.focus();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <AdHocFilterEditor
        filter={filter}
        populateInput={populateInput}
        isLastFilter={isLastFilter}
        allowCustomValue={allowCustomValue}
        onDone={(focusTarget: AdHocFilterEditorFocusTarget) => {
          focusPillOnViewRef.current = focusTarget === 'pill';
          onEndEdit();
          if (focusTarget === 'add-input') {
            focusAddInput();
          }
        }}
      />
    );
  }

  const keyLabel = filter.keyLabel ?? filter.key;
  const valueLabel =
    filter.valueLabels?.join(', ') || filter.values?.join(', ') || filter.value;

  return (
    <div
      ref={pillRef}
      className={styles.pill}
      role="button"
      tabIndex={0}
      aria-label={`Edit filter with key ${keyLabel}`}
      onClick={(event) => {
        event.stopPropagation();
        onStartEdit(true);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onStartEdit(true);
        }
      }}
    >
      <span className={styles.text}>
        {`${keyLabel} ${filter.operator} ${valueLabel}`}
      </span>
      <IconButton
        name="times"
        size="sm"
        className={styles.removeButton}
        aria-label={`Remove filter with key ${keyLabel}`}
        onClick={(event) => {
          event.stopPropagation();
          onRemoveFilter(filter);
          focusAddInput();
        }}
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  pill: css({
    display: 'flex',
    alignItems: 'center',
    background: theme.colors.action.selected,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(0.125, 0, 0.125, 1),
    minHeight: theme.spacing(2.75),
    color: theme.colors.text.primary,
    ...theme.typography.bodySmall,
    fontWeight: theme.typography.fontWeightBold,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  text: css({
    maxWidth: '280px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
  removeButton: css({
    marginInline: theme.spacing(0.5),
  }),
});
