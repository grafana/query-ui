import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { TimeRangeContextProvider, UrlStateProvider } from '@grafana/query-ui';

import { AdhocFiltersDemoPage } from './pages/AdhocFiltersDemoPage';
import { HomePage } from './pages/HomePage';
import { LazyGridDemoPage } from './pages/LazyGridDemoPage';
import { ManySeriesDemoPage } from './pages/ManySeriesDemoPage';
import { PanelGridLayoutDemoPage } from './pages/PanelGridLayoutDemoPage';
import { QueryVariableDemoPage } from './pages/QueryVariableDemoPage';
import { SinglePanelDemoPage } from './pages/SinglePanelDemoPage';
import { SlowQueryDemoPage } from './pages/SlowQueryDemoPage';
import { VariablesDemoPage } from './pages/VariablesDemoPage';

const queryClient = new QueryClient();

export function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <UrlStateProvider>
          <TimeRangeContextProvider>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route
                path="/panel-grid-layout-demo"
                element={<PanelGridLayoutDemoPage />}
              />
              <Route path="/lazy-grid-demo" element={<LazyGridDemoPage />} />
              <Route
                path="/single-panel-demo"
                element={<SinglePanelDemoPage />}
              />
              <Route
                path="/adhoc-filters-demo"
                element={<AdhocFiltersDemoPage />}
              />
              <Route path="/slow-query-demo" element={<SlowQueryDemoPage />} />
              <Route
                path="/many-series-demo"
                element={<ManySeriesDemoPage />}
              />
              <Route path="/variables-demo" element={<VariablesDemoPage />} />
              <Route
                path="/query-variable-demo"
                element={<QueryVariableDemoPage />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </TimeRangeContextProvider>
        </UrlStateProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
