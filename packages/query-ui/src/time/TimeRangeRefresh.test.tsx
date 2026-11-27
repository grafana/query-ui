import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { dataQueryKey } from '../hooks/useDataQuery';
import { useTimeRange } from '../hooks/useTimeRange';
import { TimeRangeContextProvider } from './TimeRangeContext';
import { TimeRangeRefresh } from './TimeRangeRefresh';

// A plain button in place of RefreshPicker, rendering what TimeRangeRefresh
// passes to it.
vi.mock('@grafana/ui', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  RefreshPicker: (props: {
    isLoading?: boolean;
    loadingText?: string;
    onRefresh?: () => void;
  }) => (
    <button onClick={props.onRefresh}>
      {props.isLoading ? props.loadingText : 'Refresh'}
    </button>
  ),
}));

vi.mock('@grafana/plugin-compat/datasources', () => ({
  getDataSourceInstance: vi.fn(),
}));

function RefreshCount() {
  return <span data-testid="count">{useTimeRange().refreshCounter}</span>;
}

function renderRefresh() {
  const queryClient = new QueryClient();

  render(
    <QueryClientProvider client={queryClient}>
      <TimeRangeContextProvider>
        <TimeRangeRefresh />
        <RefreshCount />
      </TimeRangeContextProvider>
    </QueryClientProvider>,
  );

  return queryClient;
}

describe('TimeRangeRefresh', () => {
  it('refreshes the time range when no query is running', async () => {
    renderRefresh();

    // The default time range cache is shared between tests, so count from here.
    const before = Number(screen.getByTestId('count').textContent);

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(Number(screen.getByTestId('count').textContent)).toBe(before + 1);
  });

  it('cancels running data queries instead of refreshing', async () => {
    const queryClient = renderRefresh();
    const aborted = vi.fn();

    // Never settles, so the query stays running until it is canceled.
    void queryClient
      .fetchQuery({
        queryKey: [dataQueryKey, 'test'],
        queryFn: ({ signal }) =>
          new Promise<never>(() => signal.addEventListener('abort', aborted)),
      })
      .catch(() => {});

    const before = screen.getByTestId('count').textContent;
    const button = await screen.findByRole('button', { name: 'Cancel' });
    await userEvent.click(button);

    await waitFor(() => expect(aborted).toHaveBeenCalled());
    expect(screen.getByTestId('count').textContent).toBe(before);
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  });
});
