import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useNavigate } from 'react-router-dom';

import { TimeRangeContextProvider } from '../../time/TimeRangeContext';
import { UrlStateProvider } from '../../url/UrlStateContext';
import { useReplaceVariables } from './useReplaceVariables';

const now = new Date('2026-01-01T12:00:00Z').valueOf();
const sixHoursAgo = new Date('2026-01-01T06:00:00Z').valueOf();

function wrapper({ children }: { children: ReactNode }) {
  return (
    <TimeRangeContextProvider initFrom="now-6h" initTo="now" timeZone="utc">
      {children}
    </TimeRangeContextProvider>
  );
}

describe('useReplaceVariables', () => {
  beforeEach(() => {
    // Freeze time so "now" evaluates to the same instant on every render.
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // $__from and $__to read the range from scopedVars.__timeRange
  it('adds the time range to scopedVars as __timeRange', () => {
    const { result } = renderHook(() => useReplaceVariables(), { wrapper });

    expect(result.current('$__from to $__to')).toBe(`${sixHoursAgo} to ${now}`);
  });

  it('adds __timeRange alongside the scopedVars the caller passes', () => {
    const { result } = renderHook(() => useReplaceVariables(), { wrapper });

    expect(result.current('$__from to $__to', { series: { value: 'A' } })).toBe(
      `${sixHoursAgo} to ${now}`,
    );
  });

  describe('__location', () => {
    function routerWrapper({ children }: { children: ReactNode }) {
      return (
        <MemoryRouter initialEntries={['/my-page?from=now-6h&to=now']}>
          <UrlStateProvider>{wrapper({ children })}</UrlStateProvider>
        </MemoryRouter>
      );
    }

    it('adds the router location for ${__url}', () => {
      const { result } = renderHook(() => useReplaceVariables(), {
        wrapper: routerWrapper,
      });

      expect(result.current('${__url}')).toBe('/my-page?from=now-6h&to=now');
      expect(result.current('${__url.path}')).toBe('/my-page');
    });

    it('re-renders a component that interpolates ${__url} when the location changes', () => {
      function ShowUrl() {
        const replace = useReplaceVariables();
        return <span data-testid="url">{replace('${__url}')}</span>;
      }

      function NavigateButton() {
        const navigate = useNavigate();
        return (
          // Keeps the time range, so only the location changes.
          <button
            onClick={() => navigate('/other-page?from=now-6h&to=now&var-a=1')}
          >
            navigate
          </button>
        );
      }

      render(<ShowUrl />, {
        wrapper: ({ children }) =>
          routerWrapper({
            children: (
              <>
                {children}
                <NavigateButton />
              </>
            ),
          }),
      });

      expect(screen.getByTestId('url')).toHaveTextContent(
        '/my-page?from=now-6h&to=now',
      );

      fireEvent.click(screen.getByRole('button', { name: 'navigate' }));

      expect(screen.getByTestId('url')).toHaveTextContent(
        '/other-page?from=now-6h&to=now&var-a=1',
      );
    });

    it('leaves ${__url} intact outside a router', () => {
      const { result } = renderHook(() => useReplaceVariables(), { wrapper });

      expect(result.current('${__url}')).toBe('${__url}');
    });
  });
});
