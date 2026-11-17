import { VariableSort } from '@grafana/data';
import { GridPanelLayout, useVariableOptionsQuery, VizPanel } from '@grafana/scenes2';
import { Button, Combobox, Field, RadioButtonGroup, Stack } from '@grafana/ui';
import React, { useMemo, useState } from 'react';

import { plainTimeSeriesGraph } from '../../components/sharedVisualizations';
import { GRID_TEMPLATE_COLUMNS, layoutOptions, type LayoutMode } from '../shared/panelLayout';
import { useMetricData } from '../useMetricData';

/** Labels that describe the metric itself rather than a dimension worth breaking down by. */
const EXCLUDED_LABELS = new Set(['__name__', 'le']);

interface BreakdownTabProps {
  metric: string;
  dsUid: string;
}

/** Shows the metric grouped by each of its labels, one panel per label. */
export function BreakdownTab({ metric, dsUid }: BreakdownTabProps) {
  const query = `label_names(${metric})`;
  const [selectedLabel, setSelectedLabel] = useState<string>();
  const [layout, setLayout] = useState<LayoutMode>('grid');

  const labelNames = useVariableOptionsQuery({
    enabled: true,
    datasource: { uid: dsUid },
    query,
    sort: VariableSort.alphabeticalAsc,
  });

  const labels = useMemo(
    () => (labelNames.data ?? []).map((option) => String(option.value)).filter((name) => !EXCLUDED_LABELS.has(name)),
    [labelNames.data]
  );

  const labelOptions = useMemo(() => labels.map((label) => ({ label, value: label })), [labels]);

  // The label can disappear when the filters or the time range change.
  const activeLabel = selectedLabel && labels.includes(selectedLabel) ? selectedLabel : undefined;

  return (
    <Stack direction="column" gap={2}>
      <Stack justifyContent="space-between" alignItems="flex-end">
        <Field label="By label" noMargin>
          <Combobox
            width={30}
            options={labelOptions}
            value={activeLabel ?? null}
            placeholder="All"
            loading={labelNames.isLoading}
            isClearable
            onChange={(option) => setSelectedLabel(option?.value)}
          />
        </Field>
        {!activeLabel && (
          <Field label="View" noMargin>
            <RadioButtonGroup options={layoutOptions} value={layout} onChange={setLayout} />
          </Field>
        )}
      </Stack>
      {labelNames.isError && <pre>{labelNames.error.message}</pre>}
      {labelNames.data && labels.length === 0 && <div>This metric has no labels to break down by.</div>}
      {activeLabel ? (
        <div style={{ height: 400 }}>
          <BreakdownPanel metric={metric} dsUid={dsUid} label={activeLabel} />
        </div>
      ) : (
        labels.length > 0 && (
          <GridPanelLayout isLazy templateColumns={GRID_TEMPLATE_COLUMNS[layout]}>
            {labels.map((label) => (
              <BreakdownPanel key={label} metric={metric} dsUid={dsUid} label={label} onSelect={setSelectedLabel} />
            ))}
          </GridPanelLayout>
        )
      )}
    </Stack>
  );
}

interface BreakdownPanelProps {
  metric: string;
  dsUid: string;
  label: string;
  /** Adds a Select button to the panel. Leave it out to hide the button. */
  onSelect?: (label: string) => void;
}

const BreakdownPanel = React.memo(function BreakdownPanel({ metric, dsUid, label, onSelect }: BreakdownPanelProps) {
  const data = useMetricData(metric, dsUid, { groupBy: label });
  const seriesCount = data.data?.series.length;

  return (
    <VizPanel
      title={seriesCount === undefined ? label : `${label} (${seriesCount})`}
      vizConfig={plainTimeSeriesGraph}
      data={data.data}
      actions={
        // A label with a single value has nothing to compare, so selecting it adds nothing.
        onSelect && seriesCount !== undefined && seriesCount > 1 ? (
          <Button size="sm" variant="secondary" onClick={() => onSelect(label)}>
            Select
          </Button>
        ) : undefined
      }
    />
  );
});
