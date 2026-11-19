import { css } from '@emotion/css';
import type { ReactNode, RefCallback } from 'react';
import { useMeasure } from 'react-use';
import { LoadingState, type PanelData } from '@grafana/data';
import { PanelChrome, PanelContextProvider } from '@grafana/ui';

import type { VizConfig } from './PanelBuilders/types';
import { usePanelContextState } from './usePanelContextState';
import { useVizPanel } from './useVizPanel';

export interface VizPanelProps {
  /** Panel title. Variables like `$var` are interpolated. */
  title?: string;
  /**
   * Shown in a tooltip from the info icon in the panel header. Supports
   * markdown, and variables like `$var` are interpolated.
   */
  description?: string;
  vizConfig: VizConfig;
  data?: PanelData;
  /** Rendered in the panel header, for example buttons. */
  actions?: ReactNode;
}

export function VizPanel(props: VizPanelProps) {
  const {
    title,
    getDescription,
    plugin,
    isLoading,
    fieldConfig,
    panelOptions,
    panelData,
    onChangeTimeRange,
    onCancelQuery,
    onFieldConfigChange,
    onOptionsChange,
  } = useVizPanel(props);
  const panelContext = usePanelContextState({
    fieldConfig,
    options: panelOptions,
    frames: panelData.series,
    onFieldConfigChange,
    onOptionsChange,
  });
  const [ref, { width, height }] = useMeasure<HTMLDivElement>();

  return (
    <div className={relativeWrapper}>
      <div ref={ref as RefCallback<HTMLDivElement>} className={absoluteWrapper}>
        {width > 0 && height > 0 && (
          <PanelContextProvider value={panelContext}>
            <PanelChrome
              title={title}
              description={getDescription}
              width={width}
              height={height}
              loadingState={isLoading ? LoadingState.Loading : undefined}
              actions={props.actions}
              onCancelQuery={onCancelQuery}
            >
              {(innerWidth, innerHeight) => (
                <>
                  {plugin?.panel && (
                    <plugin.panel
                      id={1}
                      title={title}
                      options={panelOptions}
                      data={panelData}
                      timeZone={'browser'}
                      width={innerWidth}
                      height={innerHeight}
                      renderCounter={0}
                      timeRange={panelData.timeRange}
                      fieldConfig={fieldConfig}
                      transparent={false}
                      onFieldConfigChange={onFieldConfigChange}
                      onOptionsChange={onOptionsChange}
                      replaceVariables={(value: string) => value}
                      onChangeTimeRange={onChangeTimeRange}
                      eventBus={panelContext.eventBus}
                    />
                  )}
                </>
              )}
            </PanelChrome>
          </PanelContextProvider>
        )}
      </div>
    </div>
  );
}

const relativeWrapper = css({
  position: 'relative',
  width: '100%',
  height: '100%',
});

// The absolute wrapper lets the panel shrink again after useMeasure has
// reported a larger width; without it PanelChrome's measured width becomes
// a min-content floor. See grafana/scenes VizPanelRenderer for the same fix.
const absoluteWrapper = css({
  position: 'absolute',
  width: '100%',
  height: '100%',
});
