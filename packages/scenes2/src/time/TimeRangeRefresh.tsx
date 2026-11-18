import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { rangeUtil } from '@grafana/data';
import { RefreshPicker } from '@grafana/ui';

import { dataQueryKey } from '../hooks/useDataQuery';
import { useTimeRange } from '../hooks/useTimeRange';

/**
 * Refresh button with an auto-refresh interval picker. While any data query is
 * running the button turns into a cancel button that cancels them all. Needs a
 * `QueryClientProvider` above it.
 */
export function TimeRangeRefresh() {
  const ctx = useTimeRange();
  const queryClient = useQueryClient();
  const [interval, setInterval] = useState('');
  const isLoading = useIsFetching({ queryKey: [dataQueryKey] }) > 0;

  useEffect(() => {
    if (!interval) {
      return;
    }

    // The timer always refreshes: it never cancels queries the user is waiting on.
    const id = window.setInterval(
      ctx.onRefresh,
      rangeUtil.intervalToMs(interval),
    );

    return () => window.clearInterval(id);
  }, [interval, ctx.onRefresh]);

  const { onRefresh } = ctx;
  const onClick = useCallback(() => {
    if (isLoading) {
      void queryClient.cancelQueries({ queryKey: [dataQueryKey] });
    } else {
      onRefresh();
    }
  }, [isLoading, queryClient, onRefresh]);

  return (
    <RefreshPicker
      value={interval}
      isOnCanvas
      isLoading={isLoading}
      text="Refresh"
      loadingText="Cancel"
      onRefresh={onClick}
      onIntervalChanged={setInterval}
    />
  );
}
