import { css, cx } from '@emotion/css';
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';

export interface LazyLoaderProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /**
   * How far outside the viewport the element can be and still count as "in
   * view". Accepts any CSS margin value. Loading starts before the user
   * scrolls to the element.
   * @default '100px'
   */
  rootMargin?: string;
  /**
   * Called when the element enters or leaves the viewport, including the
   * `rootMargin`.
   */
  onInViewChange?: (isInView: boolean) => void;
}

/**
 * Renders an empty placeholder until it scrolls into view, then mounts
 * `children` and keeps them mounted. Mounting is one-way so scrolling back
 * and forth does not rerun queries or discard component state.
 *
 * Mounts immediately when `IntersectionObserver` is unavailable.
 */
export function LazyLoader({
  children,
  className,
  style,
  rootMargin = '100px',
  onInViewChange,
}: LazyLoaderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hasBeenInView, setHasBeenInView] = useState(
    () => typeof IntersectionObserver === 'undefined',
  );

  // Latest callback without re-creating the observer when it changes.
  const onInViewChangeRef = useRef(onInViewChange);
  useEffect(() => {
    onInViewChangeRef.current = onInViewChange;
  });

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // Entries are ordered by time; the last one is the current state.
        const entry = entries[entries.length - 1];
        if (!entry) {
          return;
        }
        if (entry.isIntersecting) {
          setHasBeenInView(true);
        }
        onInViewChangeRef.current?.(entry.isIntersecting);
      },
      { rootMargin },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className={cx(containerStyle, className)} style={style}>
      {hasBeenInView ? children : null}
    </div>
  );
}

const containerStyle = css({
  // Positioning context for panels that lay themselves out absolutely.
  position: 'relative',
  minWidth: 0,
});
