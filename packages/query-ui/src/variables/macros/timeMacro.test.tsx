import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTimeRange } from '../../hooks/useTimeRange';
import { TimeRangeContextProvider } from '../../time/TimeRangeContext';
import { evaluateTimeRange } from '../../time/utils';
import { interpolate, useInterpolator } from '../interpolation/useInterpolator';
import type { QueryUIScopedVars } from '../types';

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

/** Scoped vars for a time range from `from` to `to`, the way useReplaceVariables passes them. */
function timeScopedVars(
  from: string,
  to: string,
  timeZone: string,
): QueryUIScopedVars {
  return {
    __timeRange: {
      value: evaluateTimeRange(
        from,
        to,
        timeZone,
        undefined,
        undefined,
        undefined,
      ),
    },
    __timeZone: { value: timeZone },
  };
}

function interpolateString(
  target: string,
  scopedVars?: QueryUIScopedVars,
  format?: string,
) {
  return interpolate(target, undefined, scopedVars, format)[0];
}

describe('time macros', () => {
  it('Can use use $__url_time_range with explicit browser timeZone', () => {
    const scopedVars = timeScopedVars('now-5m', 'now', 'browser');

    // Browser timezone should be preserved as "browser", not resolved to actual timezone
    expect(interpolateString('$__url_time_range', scopedVars)).toBe(
      'from=now-5m&to=now&timezone=browser',
    );
  });

  it('Can use use $__url_time_range with custom timeZone', () => {
    const scopedVars = timeScopedVars('now-5m', 'now', 'utc');

    expect(interpolateString('$__url_time_range', scopedVars)).toBe(
      'from=now-5m&to=now&timezone=utc',
    );
  });

  it('Does not escape $__url_time_range a second time', () => {
    const scopedVars = timeScopedVars('now-5m', 'now', 'utc');

    expect(
      interpolateString('${__url_time_range:percentencode}', scopedVars),
    ).toBe('from=now-5m&to=now&timezone=utc');
  });

  it('Can use use $__from and $__to', () => {
    const scopedVars = timeScopedVars(
      '2023-05-23T06:09:57.073Z',
      '2023-05-23T07:09:57.073Z',
      'utc',
    );

    expect(interpolateString('$__from', scopedVars)).toBe('1684822197073');
    expect(interpolateString('$__to', scopedVars)).toBe('1684825797073');

    expect(interpolateString('${__to:date:YYYY}', scopedVars)).toBe('2023');
  });

  it('When default format is text should format correctly', () => {
    const scopedVars = timeScopedVars(
      '2023-05-23T06:09:57.073Z',
      '2023-05-23T07:09:57.073Z',
      'utc',
    );

    expect(interpolateString('$__from', scopedVars, 'text')).toBe(
      '2023-05-23 06:09:57',
    );
    expect(interpolateString('$__to', scopedVars, 'text')).toBe(
      '2023-05-23 07:09:57',
    );
  });

  it('Can use use $__timezone', () => {
    const range = [
      '2023-05-23T06:09:57.073Z',
      '2023-05-23T07:09:57.073Z',
    ] as const;

    expect(
      interpolateString('$__timezone', timeScopedVars(...range, 'browser')),
    ).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(
      interpolateString(
        '$__timezone',
        timeScopedVars(...range, 'America/New_York'),
      ),
    ).toBe('America/New_York');
  });

  it('Leaves $__timezone and $__url_time_range intact without a time range', () => {
    expect(interpolateString('$__timezone')).toBe('$__timezone');
    expect(interpolateString('$__url_time_range')).toBe('$__url_time_range');
  });

  it('Can use use $__interval when the interval scoped vars are present', () => {
    const scopedVars: QueryUIScopedVars = {
      __interval: { text: '10s', value: '10s' },
      __interval_ms: { text: '10000', value: 10000 },
    };

    expect(interpolateString('$__interval', scopedVars)).toBe('10s');
    expect(interpolateString('$__interval_ms', scopedVars)).toBe('10000');
  });

  it('$__interval and $__interval_ms should return the variable expression when the interval scoped vars are missing', () => {
    expect(interpolateString('${__interval}', {})).toBe('${__interval}');
    expect(interpolateString('$__interval', {})).toBe('$__interval');
    expect(interpolateString('${__interval_ms}', {})).toBe('${__interval_ms}');
    expect(interpolateString('$__interval_ms', {})).toBe('$__interval_ms');
  });
});
