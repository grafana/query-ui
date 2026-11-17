import { css } from '@emotion/css';
import type { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

import type { EditorOption } from './editorState';

export interface MultiValuePillProps {
  item: EditorOption;
  onRemove: (item: EditorOption) => void;
  /** Moves the value back into the input for editing. */
  onEdit: (item: EditorOption) => void;
}

/** One picked value of a multi-value filter, shown while the filter is being edited. */
export function MultiValuePill({
  item,
  onRemove,
  onEdit,
}: MultiValuePillProps) {
  const styles = useStyles2(getStyles);

  return (
    <div
      className={styles.pill}
      role="button"
      tabIndex={0}
      aria-label={`Edit filter value - ${item.label}`}
      onClick={(event) => {
        event.stopPropagation();
        onEdit(item);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onEdit(item);
        }
      }}
    >
      {item.label}
      <IconButton
        name="times"
        size="sm"
        className={styles.removeButton}
        tooltip={`Remove filter value - ${item.label}`}
        onClick={(event) => {
          event.stopPropagation();
          onRemove(item);
        }}
        onKeyDownCapture={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            onRemove(item);
          }
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
    padding: theme.spacing(0.125, 0, 0.125, 1),
    color: theme.colors.text.primary,
    whiteSpace: 'nowrap',
    minHeight: theme.spacing(2.75),
    ...theme.typography.bodySmall,
    cursor: 'pointer',
  }),
  removeButton: css({
    marginInline: theme.spacing(0.5),
  }),
});
