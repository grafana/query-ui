import {
  autoUpdate,
  flip,
  offset,
  size,
  useDismiss,
  useFloating,
  type UseFloatingOptions,
  type UseFloatingReturn,
  useInteractions,
  useListNavigation,
  useRole,
} from '@floating-ui/react';
import type React from 'react';

import { MAX_MENU_HEIGHT } from './editorOptions';

export interface FloatingInteractionsOptions {
  open: boolean;
  onOpenChange: NonNullable<UseFloatingOptions['onOpenChange']>;
  activeIndex: number | null;
  onNavigate: (index: number | null) => void;
  /** One slot per dropdown row, filled by the row refs. Its length sets how far arrow keys go. */
  listRef: React.RefObject<Array<HTMLElement | null>>;
  /** Presses on these elements don't dismiss the dropdown (the editor's own segments and pills). */
  isInside: (target: EventTarget | null) => boolean;
}

type Interactions = ReturnType<typeof useInteractions>;

export interface FloatingInteractions {
  refs: UseFloatingReturn<HTMLInputElement>['refs'];
  floatingStyles: React.CSSProperties;
  getReferenceProps: Interactions['getReferenceProps'];
  getFloatingProps: Interactions['getFloatingProps'];
  getItemProps: Interactions['getItemProps'];
}

/**
 * Positions the editor dropdown under the input and wires up listbox
 * semantics, outside-press and Escape dismissal, and arrow-key navigation.
 * Navigation is virtual: focus stays in the input and `activeIndex` marks the
 * highlighted row.
 */
export function useFloatingInteractions({
  open,
  onOpenChange,
  activeIndex,
  onNavigate,
  listRef,
  isInside,
}: FloatingInteractionsOptions): FloatingInteractions {
  const { refs, floatingStyles, context } = useFloating<HTMLInputElement>({
    whileElementsMounted: autoUpdate,
    open,
    onOpenChange,
    placement: 'bottom-start',
    strategy: 'fixed',
    middleware: [
      offset(10),
      flip({ padding: 10 }),
      size({
        apply({ availableHeight, availableWidth, elements }) {
          elements.floating.style.maxHeight = `${Math.min(MAX_MENU_HEIGHT, availableHeight)}px`;
          elements.floating.style.maxWidth = `${availableWidth}px`;
        },
        padding: 10,
      }),
    ],
  });

  const role = useRole(context, { role: 'listbox' });
  const dismiss = useDismiss(context, {
    outsidePress: (event) => !isInside(event.target),
  });
  const listNavigation = useListNavigation(context, {
    listRef,
    activeIndex,
    onNavigate,
    virtual: true,
    loop: true,
  });

  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions(
    [role, dismiss, listNavigation],
  );

  return {
    refs,
    floatingStyles,
    getReferenceProps,
    getFloatingProps,
    getItemProps,
  };
}
