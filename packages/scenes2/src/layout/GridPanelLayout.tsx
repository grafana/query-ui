import { css, cx } from '@emotion/css';
import { Children, type CSSProperties, type ReactNode, useMemo } from 'react';
import type { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { LazyLoader } from './LazyLoader';

type AlignValue = CSSProperties['alignItems'];
type JustifyItemsValue = CSSProperties['justifyItems'];
type JustifyContentValue = CSSProperties['justifyContent'];

/** Layout options that can be overridden below the `md` breakpoint. */
export interface GridPanelLayoutMdOptions {
  templateColumns?: CSSProperties['gridTemplateColumns'];
  templateRows?: CSSProperties['gridTemplateRows'];
  autoRows?: CSSProperties['gridAutoRows'];
  rowGap?: number;
  columnGap?: number;
  justifyItems?: JustifyItemsValue;
  alignItems?: AlignValue;
  justifyContent?: JustifyContentValue;
}

export interface GridPanelLayoutProps extends GridPanelLayoutMdOptions {
  children: ReactNode;
  className?: string;
  /**
   * Mount each child only once it is near the viewport. Children stay
   * mounted after their first appearance.
   * @default false
   */
  isLazy?: boolean;
  /**
   * How far outside the viewport a lazy child starts loading. Any CSS margin
   * value. Ignored unless `isLazy` is set.
   * @default '100px'
   */
  lazyRootMargin?: string;
  /** Overrides applied when the viewport is narrower than the `md` breakpoint. */
  md?: GridPanelLayoutMdOptions;
}

/**
 * CSS grid layout for panels. Each child becomes a grid cell. Wrap a child in
 * {@link GridPanelLayoutItem} to place it on specific columns or rows.
 *
 * Gaps are in theme spacing units (1 = 8px).
 */
export function GridPanelLayout({
  children,
  className,
  isLazy = false,
  lazyRootMargin,
  md,
  templateColumns = 'repeat(auto-fit, minmax(400px, 1fr))',
  templateRows,
  autoRows = '320px',
  rowGap = 1,
  columnGap = 1,
  justifyItems,
  alignItems,
  justifyContent,
}: GridPanelLayoutProps) {
  const theme = useTheme2();

  const layoutClassName = useMemo(
    () =>
      getLayoutClassName(theme, {
        templateColumns,
        templateRows,
        autoRows,
        rowGap,
        columnGap,
        justifyItems,
        alignItems,
        justifyContent,
        md,
      }),
    [
      theme,
      templateColumns,
      templateRows,
      autoRows,
      rowGap,
      columnGap,
      justifyItems,
      alignItems,
      justifyContent,
      md,
    ],
  );

  // toArray gives every child a stable key, so reordering keeps lazy state.
  const items = Children.toArray(children);

  return (
    <div className={cx(layoutClassName, className)}>
      {items.map((child) => {
        if (!isLazy) {
          return child;
        }

        const key =
          typeof child === 'object' && 'key' in child ? child.key : null;

        // The wrapper is the grid cell, so it carries the placement of a
        // GridPanelLayoutItem child rather than the item itself.
        const placement = getItemPlacement(child);

        return (
          <LazyLoader key={key} rootMargin={lazyRootMargin} style={placement}>
            {child}
          </LazyLoader>
        );
      })}
    </div>
  );
}

export interface GridPanelLayoutItemProps {
  children: ReactNode;
  /** CSS `grid-column`, for example `1 / span 2`. */
  gridColumn?: CSSProperties['gridColumn'];
  /** CSS `grid-row`, for example `span 2`. */
  gridRow?: CSSProperties['gridRow'];
  className?: string;
}

/**
 * Places a child on specific grid columns or rows. Use it inside
 * {@link GridPanelLayout}.
 */
export function GridPanelLayoutItem({
  children,
  gridColumn,
  gridRow,
  className,
}: GridPanelLayoutItemProps) {
  return (
    <div className={cx(itemStyle, className)} style={{ gridColumn, gridRow }}>
      {children}
    </div>
  );
}

function getItemPlacement(child: ReactNode): CSSProperties | undefined {
  if (
    typeof child === 'object' &&
    child !== null &&
    'type' in child &&
    child.type === GridPanelLayoutItem
  ) {
    const { gridColumn, gridRow } = child.props as GridPanelLayoutItemProps;
    return { gridColumn, gridRow };
  }
  return undefined;
}

interface LayoutStyleOptions extends GridPanelLayoutMdOptions {
  md?: GridPanelLayoutMdOptions;
}

function getLayoutClassName(
  theme: GrafanaTheme2,
  options: LayoutStyleOptions,
): string {
  const { md } = options;

  return css({
    display: 'grid',
    flexGrow: 1,
    gridTemplateColumns: options.templateColumns,
    gridTemplateRows: options.templateRows,
    gridAutoRows: options.autoRows,
    rowGap: theme.spacing(options.rowGap ?? 1),
    columnGap: theme.spacing(options.columnGap ?? 1),
    justifyItems: options.justifyItems,
    alignItems: options.alignItems,
    justifyContent: options.justifyContent,
    ...(md && {
      [theme.breakpoints.down('md')]: {
        gridTemplateColumns: md.templateColumns,
        gridTemplateRows: md.templateRows,
        gridAutoRows: md.autoRows,
        rowGap: md.rowGap === undefined ? undefined : theme.spacing(md.rowGap),
        columnGap:
          md.columnGap === undefined ? undefined : theme.spacing(md.columnGap),
        justifyItems: md.justifyItems,
        alignItems: md.alignItems,
        justifyContent: md.justifyContent,
      },
    }),
  });
}

// Panels measure their parent and lay themselves out absolutely.
const itemStyle = css({
  position: 'relative',
  minWidth: 0,
  // Fills the lazy wrapper cell; harmless when the item is the cell itself.
  height: '100%',
});
