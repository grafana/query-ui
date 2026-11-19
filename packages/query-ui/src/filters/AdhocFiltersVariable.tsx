import React, { useContext, useEffect } from 'react';

import { useAdhocFilters } from '../hooks/useAdhocFilters';
import { useVariableContextState } from '../variables/DefineVariable';
import { VariableContext } from '../variables/types';
import { renderPrometheusLabelFilters } from './utils';

export interface AdhocFiltersVariableProps {
  /** Name to reference the variable by, like `${filters}`. */
  name: string;
  children: React.ReactNode;
}

/**
 * Exposes the filters of the closest `AdhocFiltersProvider` as a variable. The
 * value is the filters rendered as Prometheus label matchers, like
 * `job="api",env!="dev"`, and updates whenever the filters change. Wrap it in
 * braces where a selector is expected: `{${filters}}`.
 *
 * The value is derived from the filters, so it is never synced to the URL.
 */
export function AdhocFiltersVariable({
  name,
  children,
}: AdhocFiltersVariableProps) {
  const { filters } = useAdhocFilters();
  const parentContext = useContext(VariableContext);

  const rendered = renderPrometheusLabelFilters(filters);

  const context = useVariableContextState({
    name,
    value: { value: rendered, label: rendered },
    loading: false,
    parent: parentContext,
    skipUrlSync: true,
  });

  const { onChange } = context;
  const currentValue = context.value.value;

  useEffect(() => {
    if (currentValue !== rendered) {
      onChange({ value: rendered, label: rendered });
    }
  }, [rendered, currentValue, onChange]);

  return (
    <VariableContext.Provider value={context}>
      {children}
    </VariableContext.Provider>
  );
}
