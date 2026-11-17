import { css, cx } from '@emotion/css';
import { useCallback, useRef, useState } from 'react';
import type { GrafanaTheme2 } from '@grafana/data';
import { IconButton, styleMixins, useStyles2 } from '@grafana/ui';

import { useAdhocFilters } from '../hooks/useAdhocFilters';
import {
  AdHocFilterEditor,
  type AdHocFilterEditorHandle,
} from './AdHocFilterEditor';
import { AdHocFilterPill } from './AdHocFilterPill';
import type { AdHocFilterWithLabels } from './AdhocFiltersContext';

export interface AdHocFiltersComboboxProps {
  /** Placeholder for the "add filter" input. Defaults to `+ label = value`. */
  placeholder?: string;
  /** Offer typed text as a key or value even when the data source didn't return it. Defaults to true. */
  allowCustomValue?: boolean;
}

interface EditingFilter {
  filter: AdHocFilterWithLabels;
  populateInput: boolean;
}

/**
 * Renders the committed filters as pills, plus an always-present input for
 * adding the next one. Click a pill to edit it; Backspace in the empty input
 * steps back into the last filter. Reads and writes filters through
 * AdhocFiltersContext - wrap this in an AdhocFiltersProvider.
 */
export function AdHocFiltersCombobox({
  placeholder,
  allowCustomValue = true,
}: AdHocFiltersComboboxProps = {}) {
  const { filters, onRemoveFilter } = useAdhocFilters();
  const styles = useStyles2(getStyles);
  const [editing, setEditing] = useState<EditingFilter | null>(null);
  const addInputRef = useRef<AdHocFilterEditorHandle>(null);

  const focusAddInput = useCallback(() => addInputRef.current?.focus(), []);
  const endEdit = useCallback(() => setEditing(null), []);

  return (
    <div
      className={cx(styles.wrapper, styles.focusOutline)}
      onClick={(event) => {
        // Clicks on the empty area act like clicks on the "add filter" input.
        if (event.target === event.currentTarget) {
          addInputRef.current?.focus({ open: true });
        }
      }}
    >
      {filters.map((filter, index) => (
        <AdHocFilterPill
          key={`${filter.key}-${index}`}
          filter={filter}
          isEditing={editing?.filter === filter}
          populateInput={editing?.populateInput}
          isLastFilter={index === filters.length - 1}
          allowCustomValue={allowCustomValue}
          onStartEdit={(populateInput) => setEditing({ filter, populateInput })}
          onEndEdit={endEdit}
          focusAddInput={focusAddInput}
        />
      ))}

      <AdHocFilterEditor
        ref={addInputRef}
        placeholder={placeholder}
        allowCustomValue={allowCustomValue}
        onBackspaceEmpty={() => {
          const last = filters.at(-1);
          if (last) {
            setEditing({ filter: last, populateInput: false });
          }
        }}
      />

      {filters.length > 0 ? (
        <IconButton
          name="times"
          size="md"
          className={styles.clearAll}
          tooltip="Clear all"
          onClick={(event) => {
            event.stopPropagation();
            filters.forEach(onRemoveFilter);
            setEditing(null);
            focusAddInput();
          }}
        />
      ) : null}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: theme.spacing(1),
    rowGap: theme.spacing(0.5),
    minHeight: theme.spacing(theme.components.height.md),
    backgroundColor: theme.components.input.background,
    border: `1px solid ${theme.components.input.borderColor}`,
    borderRadius: theme.shape.radius.default,
    paddingInline: theme.spacing(1),
    paddingBlock: theme.spacing(0.25),
    width: '100%',
    cursor: 'text',
  }),
  focusOutline: css({
    '&:focus-within': {
      ...styleMixins.getFocusStyles(theme),
    },
  }),
  clearAll: css({
    marginLeft: 'auto',
    color: theme.colors.text.secondary,
  }),
});
