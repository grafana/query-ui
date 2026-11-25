import { TimeRangeContextPicker, TimeRangeRefresh } from '@grafana/query-ui';

import { PluginPage, type PluginPageProps } from './PluginPage';

interface ScenarioPageProps extends Pick<
  PluginPageProps,
  'title' | 'description' | 'children'
> {
  showTimeControls?: boolean;
}

export function ScenarioPage({
  title,
  description,
  children,
  showTimeControls = true,
}: ScenarioPageProps) {
  return (
    <PluginPage
      title={title}
      description={description}
      breadcrumbs={[{ text: 'Scenarios', url: '/' }, { text: title }]}
      actions={
        showTimeControls ? (
          <>
            <TimeRangeContextPicker />
            <TimeRangeRefresh />
          </>
        ) : undefined
      }
    >
      {children}
    </PluginPage>
  );
}
