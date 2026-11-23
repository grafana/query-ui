import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import { TimeRangeContextProvider } from '../../time/TimeRangeContext';
import { useReplaceVariables } from './useReplaceVariables';

// The real module drags @grafana/ui (and uplot's CSS) into jsdom; the time
// utils only read the boot data time zone from it.
vi.mock('@grafana/runtime', () => ({
  config: { bootData: { user: { timezone: 'utc' } } },
}));

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
});
