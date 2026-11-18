import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTimeRange } from '../../hooks/useTimeRange';
import { TimeRangeContextProvider } from '../../time/TimeRangeContext';
import { useInterpolator } from '../interpolation/useInterpolator';

// The real module drags @grafana/ui (and uplot's CSS) into jsdom; the time
// utils only read the boot data time zone from it.
vi.mock('@grafana/runtime', () => ({
  config: { bootData: { user: { timezone: 'utc' } } },
}));

const now = new Date('2026-01-01T12:00:00Z');
const sixHoursAgo = new Date('2026-01-01T06:00:00Z').valueOf();
const oneHourAgo = new Date('2026-01-01T11:00:00Z').valueOf();

/** Renders `$__from` through the interpolator, the way a panel title would. */
function ShowFrom() {
  const timeRange = useTimeRange();
  const [from] = useInterpolator('$__from', {
    __timeRange: { value: timeRange.value },
  });

  return <span data-testid="from">{from}</span>;
}

function ChangeTimeRange() {
  const { value, onChangeTimeRange } = useTimeRange();

  return (
    <button
      onClick={() =>
        onChangeTimeRange({ ...value, raw: { from: 'now-1h', to: 'now' } })
      }
    >
      last 1h
    </button>
  );
}

describe('$__from macro', () => {
  beforeEach(() => {
    // Freeze time so "now" evaluates to the same instant on every render.
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('interpolates to the start of the time range in epoch milliseconds', () => {
    render(
      <TimeRangeContextProvider initFrom="now-6h" initTo="now" timeZone="utc">
        <ShowFrom />
      </TimeRangeContextProvider>,
    );

    expect(screen.getByTestId('from')).toHaveTextContent(String(sixHoursAgo));
  });

  it('re-renders with the new start when the time range changes', () => {
    render(
      <TimeRangeContextProvider initFrom="now-6h" initTo="now" timeZone="utc">
        <ShowFrom />
        <ChangeTimeRange />
      </TimeRangeContextProvider>,
    );

    expect(screen.getByTestId('from')).toHaveTextContent(String(sixHoursAgo));

    fireEvent.click(screen.getByRole('button', { name: 'last 1h' }));

    expect(screen.getByTestId('from')).toHaveTextContent(String(oneHourAgo));
  });
});
