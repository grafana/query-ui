import { Route, Routes } from 'react-router-dom';
import { AppRootProps } from '@grafana/data';
import { TimeRangeContextProvider, UrlStateProvider } from '@grafana/query-ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PluginPropsContext } from './utils/utils.plugin';
import { DemoHome } from 'components/DemoHome';
import { demos } from './demos';

const queryClient = new QueryClient();

function App(props: AppRootProps) {
  return (
    <PluginPropsContext.Provider value={props}>
      <QueryClientProvider client={queryClient}>
        <UrlStateProvider>
          <TimeRangeContextProvider>
            <Routes>
              {demos.map(({ route, component: Component }) => (
                <Route key={route} path={route} element={<Component />} />
              ))}
              <Route path="*" element={<DemoHome />} />
            </Routes>
          </TimeRangeContextProvider>
        </UrlStateProvider>
      </QueryClientProvider>
    </PluginPropsContext.Provider>
  );
}

export default App;
