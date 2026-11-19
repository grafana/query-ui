import { css, cx } from '@emotion/css';
import React, { useId } from 'react';
import type { GrafanaTheme2 } from '@grafana/data';
import { Checkbox, useStyles2 } from '@grafana/ui';

export interface DropdownItemProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  active?: boolean;
  /** Show a checkbox, for picking several values. */
  checkable?: boolean;
  checked?: boolean;
  /** A placeholder row (loading, empty) rather than a pickable option. */
  nonInteractive?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

/** One row in the editor dropdown. Absolutely positioned by the virtual list. */
export function DropdownItem({
  children,
  active,
  checkable,
  checked,
  nonInteractive,
  className,
  ref,
  ...rest
}: DropdownItemProps) {
  const styles = useStyles2(getStyles);
  const id = useId();
  const ariaProps = nonInteractive
    ? {}
    : { role: 'option', 'aria-selected': active };

  return (
    <div
      ref={ref}
      id={id}
      {...ariaProps}
      className={cx(
        styles.option,
        active && styles.optionActive,
        nonInteractive && styles.optionNonInteractive,
        className,
      )}
      {...rest}
    >
      <div className={styles.optionBody}>
        <span className={styles.optionLabel}>
          {checkable ? (
            <Checkbox
              tabIndex={-1}
              checked={checked}
              onChange={noop}
              className={styles.checkbox}
            />
          ) : null}
          {children}
        </span>
      </div>
    </div>
  );
}

function noop() {}

export function PlaceholderItem({ children }: { children: React.ReactNode }) {
  return <DropdownItem nonInteractive>{children}</DropdownItem>;
}

const getStyles = (theme: GrafanaTheme2) => ({
  option: css({
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    padding: theme.spacing(1),
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  optionActive: css({
    background: theme.colors.action.focus,
    '@media (forced-colors: active), (prefers-contrast: more)': {
      border: `1px solid ${theme.colors.primary.border}`,
    },
  }),
  optionNonInteractive: css({
    position: 'static',
    cursor: 'default',
    color: theme.colors.text.secondary,
    '&:hover': {
      background: 'transparent',
    },
  }),
  optionBody: css({
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  optionLabel: css({
    display: 'flex',
    alignItems: 'center',
  }),
  checkbox: css({
    paddingRight: theme.spacing(0.5),
    // The row handles the click; the checkbox only shows state.
    pointerEvents: 'none',
  }),
});
