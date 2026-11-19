import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTheme } from '@grafana/data';

import { GridPanelLayout, GridPanelLayoutItem } from './GridPanelLayout';

// The real module pulls uplot and other browser-only code into jsdom.
vi.mock('@grafana/ui', () => ({
  useTheme2: () => createTheme(),
}));

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

interface FakeObserver {
  callback: ObserverCallback;
  options?: IntersectionObserverInit;
  target?: Element;
  disconnected: boolean;
}

let observers: FakeObserver[] = [];

function setInView(target: Element, isIntersecting: boolean) {
  act(() => {
    for (const observer of observers) {
      if (observer.target === target && !observer.disconnected) {
        observer.callback([{ isIntersecting }]);
      }
    }
  });
}

beforeEach(() => {
  observers = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      private record: FakeObserver;
      constructor(
        callback: ObserverCallback,
        options?: IntersectionObserverInit,
      ) {
        this.record = { callback, options, disconnected: false };
        observers.push(this.record);
      }
      observe(target: Element) {
        this.record.target = target;
      }
      disconnect() {
        this.record.disconnected = true;
      }
      unobserve() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('GridPanelLayout', () => {
  it('renders all children without observers when not lazy', () => {
    render(
      <GridPanelLayout>
        <div>A</div>
        <div>B</div>
      </GridPanelLayout>,
    );

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(observers).toHaveLength(0);
  });

  it('applies grid styles from props', () => {
    const { container } = render(
      <GridPanelLayout
        templateColumns="1fr 1fr"
        autoRows="100px"
        rowGap={2}
        columnGap={3}
      >
        <div>A</div>
      </GridPanelLayout>,
    );

    const style = getComputedStyle(container.firstElementChild!);
    expect(style.display).toBe('grid');
    expect(style.gridTemplateColumns).toBe('1fr 1fr');
    expect(style.gridAutoRows).toBe('100px');
    expect(style.rowGap).toBe('16px');
    expect(style.columnGap).toBe('24px');
  });

  describe('when lazy', () => {
    it('does not mount children until they come into view', () => {
      render(
        <GridPanelLayout isLazy>
          <div>A</div>
          <div>B</div>
        </GridPanelLayout>,
      );

      expect(screen.queryByText('A')).not.toBeInTheDocument();
      expect(screen.queryByText('B')).not.toBeInTheDocument();
      expect(observers).toHaveLength(2);
    });

    it('mounts only the child that comes into view', () => {
      const { container } = render(
        <GridPanelLayout isLazy>
          <div>A</div>
          <div>B</div>
        </GridPanelLayout>,
      );

      const cells = container.firstElementChild!.children;
      setInView(cells[1], true);

      expect(screen.queryByText('A')).not.toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
    });

    it('keeps a child mounted after it leaves the view', () => {
      const { container } = render(
        <GridPanelLayout isLazy>
          <div>A</div>
        </GridPanelLayout>,
      );

      const cell = container.firstElementChild!.children[0];
      setInView(cell, true);
      setInView(cell, false);

      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('passes lazyRootMargin to the observer', () => {
      render(
        <GridPanelLayout isLazy lazyRootMargin="300px">
          <div>A</div>
        </GridPanelLayout>,
      );

      expect(observers[0].options?.rootMargin).toBe('300px');
    });

    it('places the lazy wrapper using the GridPanelLayoutItem placement', () => {
      const { container } = render(
        <GridPanelLayout isLazy>
          <GridPanelLayoutItem gridColumn="1 / span 2">
            <div>A</div>
          </GridPanelLayoutItem>
        </GridPanelLayout>,
      );

      const cell = container.firstElementChild!.children[0] as HTMLElement;
      expect(cell.style.gridColumn).toBe('1 / span 2');
    });

    it('disconnects observers on unmount', () => {
      const { unmount } = render(
        <GridPanelLayout isLazy>
          <div>A</div>
        </GridPanelLayout>,
      );

      unmount();
      expect(observers.every((o) => o.disconnected)).toBe(true);
    });

    it('mounts children immediately without IntersectionObserver', () => {
      vi.stubGlobal('IntersectionObserver', undefined);

      render(
        <GridPanelLayout isLazy>
          <div>A</div>
        </GridPanelLayout>,
      );

      expect(screen.getByText('A')).toBeInTheDocument();
    });
  });
});

describe('GridPanelLayoutItem', () => {
  it('sets grid placement', () => {
    render(
      <GridPanelLayoutItem gridColumn="span 2" gridRow="1 / 3">
        <div>A</div>
      </GridPanelLayoutItem>,
    );

    const item = screen.getByText('A').parentElement!;
    expect(item.style.gridColumn).toBe('span 2');
    expect(item.style.gridRow).toBe('1 / 3');
  });
});
